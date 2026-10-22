import { runDigitAdmission } from "./digit/run.mjs";
import { runFhplPreauth } from "./fhpl/run.mjs";
import { runIciciPreauth } from "./icici/run.mjs";
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
  icici: {
    id: "icici",
    defaultAction: "preauth",
    actions: {
      preauth: runIciciPreauth,
    },
  },
  digit: {
    id: "digit",
    defaultAction: "admission",
    actions: {
      admission: runDigitAdmission,
    },
  },
};

const aliases = {
  epreauth: "fhpl",
  ilhc: "icici",
  icicilombard: "icici",
  godigit: "digit",
  digitfirst: "digit",
};

export function listPortalIds() {
  return [...Object.keys(portals), ...Object.keys(aliases)];
}

export function getPortal(tpaId) {
  const key = String(tpaId ?? "").trim().toLowerCase();
  return portals[aliases[key] ?? key];
}
