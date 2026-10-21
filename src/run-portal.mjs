import { dispatch } from "./dispatcher.mjs";
import { AutomationError } from "./shared/errors.mjs";
import { createLogger } from "./shared/logger.mjs";
import { listPortalIds } from "./portals/registry.mjs";

const log = createLogger("tpaflow");

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[index + 1];
}

const tpaId = argument("tpa") ?? process.env.TPA_ID;
const action = argument("action") ?? process.env.TPA_ACTION;

if (!tpaId) {
  log.error(`Pass --tpa <id>. Registered portals: ${listPortalIds().join(", ")}.`);
  process.exit(1);
}

try {
  await dispatch({ tpaId, action });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  log.error(message);
  if (error instanceof AutomationError && error.cause) {
    log.error(error.cause instanceof Error ? error.cause.message : String(error.cause));
  }
  process.exit(1);
}
