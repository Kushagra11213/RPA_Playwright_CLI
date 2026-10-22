import { readFileSync } from "node:fs";
import { credentialsFile } from "../shared/paths.mjs";
import { portals } from "../portals/registry.mjs";

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hostOf(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function portalList() {
  return Object.values(portals);
}

export function portalForIdentity({ tpaName, portalUrl }) {
  const host = hostOf(portalUrl);
  const name = normalize(tpaName);
  return portalList().find((portal) => {
    if (host && portal.hosts?.includes(host)) return true;
    return portal.names?.some((token) => name.includes(normalize(token)));
  });
}

function configuredForPortal(entries, portal, tpaName, portalUrl) {
  const host = hostOf(portalUrl);
  const name = normalize(tpaName);
  return entries.some((entry) => {
    const entryHost = hostOf(entry.portalUrl);
    const entryName = normalize(entry.tpaName);
    const sameHost = host && entryHost === host;
    const sameName = name && entryName && (entryName.includes(name) || name.includes(entryName));
    const portalHost = portal.hosts?.includes(entryHost);
    const portalName = portal.names?.some((token) => entryName.includes(normalize(token)));
    return (sameHost || sameName) && (portalHost || portalName);
  });
}

export function loadCredentialEntries(file = credentialsFile) {
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("TpaCreds.json must be a list.");
  }
  return parsed;
}

export function selectHospitalCredential(credentials, payer) {
  const list = Array.isArray(credentials) ? credentials : [];
  const active = list.filter((entry) => String(entry?.status ?? "ACTIVE").toUpperCase() === "ACTIVE");
  const pool = active.length ? active : list;
  const portalCredentials = pool.filter((entry) => {
    const platform = String(entry?.tpamaster?.platform ?? "").toLowerCase();
    return platform !== "email" && entry?.tpamaster?.urlOrReceiverMail;
  });
  if (payer) {
    const named = portalCredentials.find((entry) => entry.tpa === payer || entry.tpamaster?.tpa === payer || entry.tpaName === payer);
    if (named) return named;
  }
  return portalCredentials[0];
}

export function identityOf(credential) {
  return {
    tpaName: credential?.tpaName || credential?.tpa || credential?.tpamaster?.tpa || "",
    portalUrl: credential?.tpamaster?.urlOrReceiverMail || credential?.portalUrl || "",
    username: credential?.userName || credential?.username || "",
    password: credential?.password || "",
  };
}

export function matchTpaCase(payload, entries) {
  const credential = selectHospitalCredential(payload?.hospitalTpaCredentials, payload?.caseData?.payer ?? null);
  if (!credential) {
    return { matched: false, reason: "tpa-case-data did not include portal credentials." };
  }
  const identity = identityOf(credential);
  if (!identity.username || !identity.password || !identity.portalUrl) {
    return { matched: false, reason: "tpa-case-data credentials are incomplete." };
  }
  const portal = portalForIdentity(identity);
  if (!portal) {
    return { matched: false, reason: `no registered automation for ${identity.tpaName || identity.portalUrl}.` };
  }
  if (!configuredForPortal(entries, portal, identity.tpaName, identity.portalUrl)) {
    return { matched: false, reason: `${identity.tpaName || portal.id} is not configured in TpaCreds.json.` };
  }
  return {
    matched: true,
    portal,
    credentials: {
      portalUrl: identity.portalUrl,
      username: identity.username,
      password: identity.password,
    },
  };
}
