import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AutomationError } from "./errors.mjs";
import { credentialsFile, secretsFile } from "./paths.mjs";

function envValue(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function preparePortalEnv({ match, baseUrl, session }) {
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
  if (!entry.username || !entry.password) {
    throw new AutomationError(`Credential match has no username or password: ${entry.tpaName}`, {
      code: "CREDENTIALS_MISSING",
    });
  }

  writeFileSync(
    secretsFile,
    [
      `BASE_URL=${envValue(baseUrl)}`,
      `LOGIN_USERNAME=${envValue(entry.username)}`,
      `LOGIN_PASSWORD=${envValue(entry.password)}`,
      `PLAYWRIGHT_CLI_SESSION=${session}`,
      "",
    ].join("\n"),
    "utf8",
  );

  return {
    tpaName: entry.tpaName,
    username: entry.username,
    secretsFile,
  };
}

export function secretsPath() {
  return path.resolve(secretsFile);
}
