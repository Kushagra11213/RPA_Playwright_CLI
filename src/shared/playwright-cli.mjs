import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AutomationError } from "./errors.mjs";
import { root, secretsFile } from "./paths.mjs";

const cli = path.join(root, "node_modules", "@playwright", "cli", "playwright-cli.js");

export function createPlaywrightSession(session) {
  function run(args, { allowFailure = false } = {}) {
    const result = spawnSync(process.execPath, [cli, `-s=${session}`, ...args], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PLAYWRIGHT_CLI_SESSION: session,
        PLAYWRIGHT_MCP_SECRETS_FILE: secretsFile,
      },
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (output) {
      process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
    }
    if (result.error) {
      throw new AutomationError(result.error.message, {
        code: "PLAYWRIGHT_CLI",
        cause: result.error,
      });
    }
    if (!allowFailure && result.status !== 0) {
      throw new AutomationError(`playwright-cli ${args.join(" ")} exited with code ${result.status}`, {
        code: "PLAYWRIGHT_CLI",
      });
    }
    return output;
  }

  function snapshotText(output) {
    const match = output.match(/\[Snapshot\]\(([^)]+)\)/);
    if (!match) {
      return output;
    }
    return readFileSync(path.resolve(root, match[1]), "utf8");
  }

  function refFor(output, patterns, label) {
    const text = snapshotText(output);
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }
    throw new AutomationError(`Could not find ${label} on the page.`, { code: "LOCATOR" });
  }

  return { run, snapshotText, refFor };
}
