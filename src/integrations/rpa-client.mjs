import { AutomationError } from "../shared/errors.mjs";
import { createLogger } from "../shared/logger.mjs";

const log = createLogger("rpa");

const DEFAULT_BASE_URL = "https://apistaging.settlemed.in";

function requireEnv(env, name) {
  const value = String(env[name] ?? "").trim();
  if (!value) {
    throw new AutomationError(`${name} is required in .env before the API flow can run.`, {
      code: "API_CONFIG",
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

export function createRpaClient({ fetchImpl = fetch, env = process.env } = {}) {
  const baseUrl = String(env.RPA_API_BASE ?? DEFAULT_BASE_URL).trim() || DEFAULT_BASE_URL;
  const userName = requireEnv(env, "RPA_USERNAME");
  const password = requireEnv(env, "RPA_PASSWORD");
  let token = "";
  let loginTask = null;

  async function readJson(response, label) {
    if (!response.ok) {
      const error = new AutomationError(`${label} failed with status ${response.status}.`, {
        code: "API_STATUS",
      });
      error.status = response.status;
      throw error;
    }
    try {
      return await response.json();
    } catch (error) {
      throw new AutomationError(`${label} returned a response that was not JSON.`, {
        code: "API_RESPONSE",
        cause: error,
      });
    }
  }

  async function login(forceRefresh = false) {
    if (!forceRefresh && token) return token;
    if (loginTask) return loginTask;

    loginTask = (async () => {
      const response = await call(apiUrl(baseUrl, "/rpa-login", { userName, password }), {
        method: "GET",
        signal: AbortSignal.timeout(60_000),
      }, "rpa-login");
      const body = await readJson(response, "rpa-login");
      const nextToken = body?.session?.token;
      if (!nextToken) {
        throw new AutomationError("rpa-login did not return a session token.", { code: "API_TOKEN" });
      }
      token = nextToken;
      return token;
    })().finally(() => {
      loginTask = null;
    });

    return loginTask;
  }

  async function call(url, init, label) {
    try {
      return await fetchImpl(url, init);
    } catch {
      throw new AutomationError(`${label} request failed.`, { code: "API_REQUEST" });
    }
  }

  async function authorizedGet(path, params, label) {
    const send = async (authToken) => {
      const response = await call(apiUrl(baseUrl, path, params), {
        method: "GET",
        headers: { "rpa-auth-token": authToken },
        signal: AbortSignal.timeout(60_000),
      }, label);
      return readJson(response, label);
    };

    try {
      return await send(await login(false));
    } catch (error) {
      if (error?.status === 401) {
        log.warn(`${label} returned 401. Refreshing the auth token and retrying once.`);
        return send(await login(true));
      }
      log.warn(`${label} failed. Retrying once.`);
      return send(await login(false));
    }
  }

  return {
    login,
    fetchRequests() {
      return authorizedGet("/rpa-requests", { isTpa: 1, isRpa: true }, "rpa-requests");
    },
    fetchCaseData(pmjayRegistrationId, documentType = "ADMISSIONDOCUMENT") {
      return authorizedGet(
        "/tpa-case-data",
        { pmjayRegistrationId, documentType, isRpa: true },
        "tpa-case-data",
      );
    },
  };
}
