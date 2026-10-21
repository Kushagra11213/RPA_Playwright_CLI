import { runFhplPreauth } from "./fhpl/run.mjs";
import { runVoloClaim } from "./volo/run.mjs";

export const portals = {
  volo: {
    id: "volo",
    defaultAction: "claim",
    actions: {
      claim: runVoloClaim,
    },
  },
  fhpl: {
    id: "fhpl",
    defaultAction: "preauth",
    actions: {
      preauth: runFhplPreauth,
    },
  },
};

const aliases = {
  epreauth: "fhpl",
};

export function listPortalIds() {
  return [...Object.keys(portals), ...Object.keys(aliases)];
}

export function getPortal(tpaId) {
  const key = String(tpaId ?? "").trim().toLowerCase();
  return portals[aliases[key] ?? key];
}
