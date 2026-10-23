import { AutomationError } from "../shared/errors.mjs";
import { createLogger } from "../shared/logger.mjs";
import { loadEnv } from "../shared/load-env.mjs";

const log = createLogger("email-otp");
const DEFAULT_BASE_URL = "https://emailautomate.settlemed.ai";

function requireEnv(env, name) {
  const value = String(env[name] ?? "").trim();
  if (!value) {
    throw new AutomationError(`${name} is required in .env before an email OTP can be read.`, {
      code: "EMAIL_OTP_CONFIG",
    });
  }
  return value;
}

function apiUrl(baseUrl, path, params) {
  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

export function createEmailOtpClient({ fetchImpl = fetch, env = process.env } = {}) {
  loadEnv();
  const source = env === process.env ? process.env : env;
  const baseUrl = String(source.EMAIL_OTP_API_BASE ?? DEFAULT_BASE_URL).trim() || DEFAULT_BASE_URL;
  const email = requireEnv(source, "EMAIL_OTP_EMAIL");
  const secret = requireEnv(source, "EMAIL_OTP_SECRET");
  let sessionCookie = "";

  async function readJson(response, label) {
    if (!response.ok) {
      const error = new AutomationError(`${label} failed with status ${response.status}.`, {
        code: "EMAIL_OTP_STATUS",
      });
      error.status = response.status;
      throw error;
    }
    try {
      return await response.json();
    } catch (error) {
      throw new AutomationError(`${label} returned a response that was not JSON.`, {
        code: "EMAIL_OTP_RESPONSE",
        cause: error,
      });
    }
  }

  async function call(url, init, label) {
    try {
      return await fetchImpl(url, init);
    } catch {
      throw new AutomationError(`${label} request failed.`, { code: "EMAIL_OTP_REQUEST" });
    }
  }

  async function login(forceRefresh = false) {
    if (!forceRefresh && sessionCookie) return sessionCookie;
    const response = await call(apiUrl(baseUrl, "/api/auth/session"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, secret }),
      signal: AbortSignal.timeout(60_000),
    }, "email session");
    const body = await readJson(response, "email session");
    const token = body?.sessionToken;
    if (!token) {
      throw new AutomationError("Email login did not return a session token.", { code: "EMAIL_OTP_TOKEN" });
    }
    const cookieName = body.cookieName || "ea_session";
    sessionCookie = body.cookieHeader || `${cookieName}=${token}`;
    return sessionCookie;
  }

  async function readBody(response, label) {
    if (!response.ok) {
      const error = new AutomationError(`${label} failed with status ${response.status}.`, {
        code: "EMAIL_OTP_STATUS",
      });
      error.status = response.status;
      throw error;
    }
    const text = await response.text();
    if (!text.trim()) return {};
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new AutomationError(`${label} returned a response that was not JSON.`, {
        code: "EMAIL_OTP_RESPONSE",
        cause: error,
      });
    }
  }

  async function syncMailbox(token) {
    const response = await call(apiUrl(baseUrl, "/api/sync"), {
      method: "POST",
      headers: { Cookie: token },
      signal: AbortSignal.timeout(60_000),
    }, "email sync");
    await readBody(response, "email sync");
  }

  async function fetchOtp(from) {
    const sender = String(from ?? "").trim();
    if (!sender) {
      throw new AutomationError("An OTP sender address is required.", { code: "EMAIL_OTP_FROM" });
    }
    const request = async (token) => {
      await syncMailbox(token);
      const response = await call(apiUrl(baseUrl, "/api/otp", { from: sender }), {
        method: "GET",
        headers: { Cookie: token },
        signal: AbortSignal.timeout(60_000),
      }, "email otp");
      return readBody(response, "email otp");
    };

    try {
      const body = await request(await login(false));
      return String(body?.otp ?? "").trim();
    } catch (error) {
      if (error?.status !== 401) throw error;
      const body = await request(await login(true));
      return String(body?.otp ?? "").trim();
    }
  }

  return { login, fetchOtp };
}

let sharedClient;

export async function fetchEmailOtp(from, {
  client,
  attempts = 8,
  delayMs = 3000,
  untilDifferentFrom = "",
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const otpClient = client ?? (sharedClient ??= createEmailOtpClient());
  const sender = String(from ?? "").trim();
  const previous = String(untilDifferentFrom ?? "").trim();
  log.info(`Fetching the email OTP for ${sender}.`);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const otp = await otpClient.fetchOtp(sender);
      if (otp && otp !== previous) {
        log.info(`Email OTP for ${sender}: ${otp}`);
        return otp;
      }
      if (otp && otp === previous) {
        log.info(`Inbox OTP for ${sender} is still ${otp}. Waiting for the new code.`);
      }
      lastError = new AutomationError(`No new OTP has arrived for ${sender}.`, { code: "EMAIL_OTP_EMPTY" });
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  throw lastError instanceof Error
    ? lastError
    : new AutomationError(`No OTP has arrived for ${sender}.`, { code: "EMAIL_OTP_EMPTY" });
}
