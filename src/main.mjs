import { runApiBatch } from "./integrations/case-source.mjs";
import { AutomationError } from "./shared/errors.mjs";
import { createLogger } from "./shared/logger.mjs";
import { loadEnv } from "./shared/load-env.mjs";

loadEnv();

const log = createLogger("tpaflow");

try {
  const summary = await runApiBatch();
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  log.error(message);
  if (error instanceof AutomationError && error.cause) {
    log.error(error.cause instanceof Error ? error.cause.message : String(error.cause));
  }
  process.exit(1);
}
