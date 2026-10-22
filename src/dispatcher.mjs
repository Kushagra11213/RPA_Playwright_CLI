import { AutomationError } from "./shared/errors.mjs";
import { createLogger } from "./shared/logger.mjs";
import { getPortal, listPortalIds } from "./portals/registry.mjs";

const log = createLogger("dispatcher");

export async function dispatch({ tpaId, action, credentials, caseData } = {}) {
  const id = String(tpaId ?? "").trim().toLowerCase();
  if (!id) {
    throw new AutomationError(`A TPA id is required. Registered portals: ${listPortalIds().join(", ")}.`, {
      code: "TPA_REQUIRED",
    });
  }

  const portal = getPortal(id);
  if (!portal) {
    throw new AutomationError(`Unknown TPA "${id}". Registered portals: ${listPortalIds().join(", ")}.`, {
      code: "TPA_UNKNOWN",
    });
  }

  const actionName = action || portal.defaultAction || Object.keys(portal.actions)[0];
  const run = portal.actions[actionName];
  if (!run) {
    const actions = Object.keys(portal.actions).join(", ");
    throw new AutomationError(`TPA "${portal.id}" has no "${actionName}" action. Available: ${actions}.`, {
      code: "ACTION_UNKNOWN",
    });
  }

  log.info(`Running ${portal.id} ${actionName}.`);
  await run({ credentials, caseData });
  log.info(`Finished ${portal.id} ${actionName}.`);
}
