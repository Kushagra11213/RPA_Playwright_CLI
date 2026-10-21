import { dispatch } from "./dispatcher.mjs";
import { resolvePortalFromApis } from "./integrations/case-source.mjs";
import { AutomationError } from "./shared/errors.mjs";
import { createLogger } from "./shared/logger.mjs";

const log = createLogger("tpaflow");

try {
  const request = await resolvePortalFromApis();
  log.info(`API selected ${request.tpaId}${request.action ? ` ${request.action}` : ""}.`);
  await dispatch({
    tpaId: request.tpaId,
    action: request.action,
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  log.error(message);
  if (error instanceof AutomationError && error.cause) {
    log.error(error.cause instanceof Error ? error.cause.message : String(error.cause));
  }
  process.exit(1);
}
