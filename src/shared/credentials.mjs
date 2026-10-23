import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AutomationError } from "./errors.mjs";
import { credentialsFile, secretsFile } from "./paths.mjs";

function envValue(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function preservedEnv(file) {
  const values = new Map();
  if (!existsSync(file)) return values;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

export function preparePortalEnv({ match, baseUrl, session, username, password }) {
  const needle = String(match ?? "").trim().toLowerCase();
  if (!needle) {
    throw new AutomationError("A portal host or TPA name is required to load credentials.", {
      code: "CREDENTIALS_MATCH",
    });
  }
  if (!baseUrl || !session) {
    throw new AutomationError("baseUrl and session are required to prepare portal credentials.", {
      code: "CREDENTIALS_CONFIG",
    });
  }

  let creds;
  try {
    creds = JSON.parse(readFileSync(credentialsFile, "utf8"));
  } catch (error) {
    throw new AutomationError("Could not read TpaCreds.json.", {
      code: "CREDENTIALS_FILE",
      cause: error,
    });
  }

  const matches = creds.filter((entry) => {
    const portal = String(entry.portalUrl ?? "").toLowerCase();
    const name = String(entry.tpaName ?? "").toLowerCase();
    return portal.includes(needle) || name.includes(needle);
  });

  if (matches.length !== 1) {
    throw new AutomationError(`Expected one credential match for "${needle}", found ${matches.length}.`, {
      code: "CREDENTIALS_MATCH",
    });
  }

  const entry = matches[0];
  const loginUsername = username || entry.username;
  const loginPassword = password || entry.password;
  if (!loginUsername || !loginPassword) {
    throw new AutomationError(`Credential match has no username or password: ${entry.tpaName}`, {
      code: "CREDENTIALS_MISSING",
    });
  }

  const values = preservedEnv(secretsFile);
  values.set("BASE_URL", envValue(baseUrl));
  values.set("LOGIN_USERNAME", envValue(loginUsername));
  values.set("LOGIN_PASSWORD", envValue(loginPassword));
  values.set("PLAYWRIGHT_CLI_SESSION", session);
  const preferred = ["BASE_URL", "LOGIN_USERNAME", "LOGIN_PASSWORD", "PLAYWRIGHT_CLI_SESSION"];
  const keys = [...preferred, ...[...values.keys()].filter((key) => !preferred.includes(key))];
  writeFileSync(secretsFile, `${keys.map((key) => `${key}=${values.get(key)}`).join("\n")}\n`, "utf8");

  return {
    tpaName: entry.tpaName,
    username: loginUsername,
    secretsFile,
  };
}

export function writeSecret(key, value) {
  const secretKey = String(key ?? "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(secretKey)) {
    throw new AutomationError("A secret name is required.", { code: "CREDENTIALS_CONFIG" });
  }
  const values = preservedEnv(secretsFile);
  values.set(secretKey, envValue(value));
  const preferred = ["BASE_URL", "LOGIN_USERNAME", "LOGIN_PASSWORD", "PLAYWRIGHT_CLI_SESSION", "LOGIN_OTP"];
  const keys = [
    ...preferred.filter((item) => values.has(item)),
    ...[...values.keys()].filter((item) => !preferred.includes(item)),
  ];
  writeFileSync(secretsFile, `${keys.map((item) => `${item}=${values.get(item)}`).join("\n")}\n`, "utf8");
  process.env[secretKey] = String(value);
}

export function secretsPath() {
  return path.resolve(secretsFile);
}
