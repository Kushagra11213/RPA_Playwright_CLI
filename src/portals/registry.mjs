import { runDigitAdmission } from "./digit/run.mjs";
import { runFhplPreauth } from "./fhpl/run.mjs";
import { runIciciPreauth } from "./icici/run.mjs";
import { runVoloClaim } from "./volo/run.mjs";

export const portals = {
  volo: {
    id: "volo",
    defaultAction: "claim",
    hosts: ["provider.volohealthtpa.com"],
    names: ["volo"],
    actions: {
      claim: runVoloClaim,
    },
  },
  fhpl: {
    id: "fhpl",
    defaultAction: "preauth",
    hosts: ["epreauth.fhpl.net"],
    names: ["family health", "epreauth", "fhpl"],
    actions: {
      preauth: runFhplPreauth,
    },
  },
  icici: {
    id: "icici",
    defaultAction: "preauth",
    hosts: ["ilhc.icicilombard.com"],
    names: ["icici lombard", "ilhc"],
    actions: {
      preauth: runIciciPreauth,
    },
  },
  digit: {
    id: "digit",
    defaultAction: "admission",
    hosts: ["first.godigit.com"],
    names: ["go digit"],
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
