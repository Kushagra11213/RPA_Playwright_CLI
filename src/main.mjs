import { runApiBatch } from "./integrations/case-source.mjs";
import { AutomationError } from "./shared/errors.mjs";
import { createLogger } from "./shared/logger.mjs";
import { loadEnv } from "./shared/load-env.mjs";

loadEnv();

const log = createLogger("tpaflow");
let stop = false;

process.on("SIGINT", () => {
  if (stop) return;
  stop = true;
  log.info("Stopping after the current case.");
});

try {
  await runApiBatch({ shouldStop: () => stop });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  log.error(message);
  if (error instanceof AutomationError && error.cause) {
    log.error(error.cause instanceof Error ? error.cause.message : String(error.cause));
  }
  process.exit(1);
}
