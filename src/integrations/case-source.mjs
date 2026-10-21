import { AutomationError } from "../shared/errors.mjs";
import { listPortalIds } from "../portals/registry.mjs";

/**
 * Used only by src/main.mjs.
 * Later, rpa-requests will provide a case id and tpa-case-date will identify
 * the portal. Those APIs are not called or specified here.
 * The resolved value must be { tpaId, action? }.
 * volo runs its claim flow. fhpl and epreauth run the preauth flow.
 */
export async function resolvePortalFromApis() {
  throw new AutomationError(
    `API dispatch is not integrated. Registered portals: ${listPortalIds().join(", ")}. Test one with npm run volo:claim or npm run fhpl:preauth.`,
    { code: "API_NOT_INTEGRATED" },
  );
}
