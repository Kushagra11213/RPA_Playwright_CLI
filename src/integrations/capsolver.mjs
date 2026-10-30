import { AutomationError } from "../shared/errors.mjs";
import { createLogger } from "../shared/logger.mjs";
import { loadEnv } from "../shared/load-env.mjs";

const log = createLogger("capsolver");
const API_BASE = "https://api.capsolver.com";

function requireKey(env) {
  const value = String(env.CAPSOLVER_KEY ?? "").trim().replace(/^"|"$/g, "");
  if (!value) {
    throw new AutomationError("CAPSOLVER_KEY is required in .env.", { code: "CAPSOLVER_CONFIG" });
  }
  return value;
}

async function post(path, body, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new AutomationError("CapSolver request failed.", { code: "CAPSOLVER_REQUEST" });
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new AutomationError(`CapSolver returned status ${response.status}.`, { code: "CAPSOLVER_RESPONSE" });
  }
  if (!response.ok || payload.errorId) {
    const detail = payload.errorDescription || payload.errorCode || `status ${response.status}`;
    throw new AutomationError(`CapSolver failed: ${detail}.`, { code: "CAPSOLVER_STATUS" });
  }
  return payload;
}

export async function solveRecaptchaV2({
  websiteURL,
  websiteKey,
  env = process.env,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  attempts = 24,
} = {}) {
  loadEnv();
  const source = env === process.env ? process.env : env;
  const clientKey = requireKey(source);
  log.info("Sending the reCAPTCHA to CapSolver.");
  const created = await post("/createTask", {
    clientKey,
    task: {
      type: "ReCaptchaV2TaskProxyLess",
      websiteURL,
      websiteKey,
    },
  }, fetchImpl);
  const taskId = created.taskId;
  if (!taskId) {
    throw new AutomationError("CapSolver did not return a task id.", { code: "CAPSOLVER_TASK" });
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await sleep(3000);
    const result = await post("/getTaskResult", { clientKey, taskId }, fetchImpl);
    if (result.status === "ready") {
      const token = result.solution?.gRecaptchaResponse;
      if (!token) {
        throw new AutomationError("CapSolver solved the task without a token.", { code: "CAPSOLVER_TOKEN" });
      }
      log.info("CapSolver solved the reCAPTCHA.");
      return token;
    }
  }
  throw new AutomationError("CapSolver did not solve the reCAPTCHA in time.", { code: "CAPSOLVER_TIMEOUT" });
}
