import assert from "node:assert/strict";
import test from "node:test";
import { dispatch } from "../src/dispatcher.mjs";
import { runApiBatch } from "../src/integrations/case-source.mjs";
import { loadCredentialEntries, matchTpaCase } from "../src/integrations/match-portal.mjs";
import { createRpaClient } from "../src/integrations/rpa-client.mjs";
import { portals } from "../src/portals/registry.mjs";

const SECRET = "batch-secret-value";
const TOKEN = "batch-token-value";
const PATIENT = "SENSITIVE PATIENT";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function credential({ tpa, url, status = "ACTIVE", platform = "Portal" }) {
  return {
    tpa,
    userName: "api-user",
    password: SECRET,
    status,
    tpamaster: { tpa, platform, urlOrReceiverMail: url, status },
  };
}

function casePayload(credentialEntry, extra = {}) {
  return {
    caseData: {
      pmjayRegistrationId: extra.registrationId ?? "case-id",
      payer: extra.payer ?? null,
      patient: { patientName: PATIENT },
    },
    documents: [],
    hospitalTpaCredentials: credentialEntry ? [credentialEntry] : [],
  };
}

const configuredEntries = [
  { tpaName: "VOLO HEALTH INSURANCE TPA PVT LTD", portalUrl: "https://provider.volohealthtpa.com/home" },
  { tpaName: "FAMILY HEALTH PLAN TPA PVT. LTD.", portalUrl: "https://epreauth.fhpl.net/SearchPreauths.aspx" },
  { tpaName: "ICICI LOMBARD GENERAL INSURANCE", portalUrl: "https://ilhc.icicilombard.com/Home/Login" },
  { tpaName: "STAR HEALTH AND ALLIED INSURANCE", portalUrl: "https://provider.ihx.in/" },
];

async function captureConsole(run) {
  const lines = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  const record = (...args) => lines.push(args.map(String).join(" "));
  console.log = record;
  console.warn = record;
  console.error = record;
  try {
    return { result: await run(), lines };
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
}

function assertNoSecrets(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  assert.equal(text.includes(SECRET), false);
  assert.equal(text.includes(TOKEN), false);
  assert.equal(text.includes(PATIENT), false);
}

test("rpa client sends the reference login, request, and case-data contract", async () => {
  const calls = [];
  let requestAttempts = 0;
  const client = createRpaClient({
    env: {
      RPA_API_BASE: "https://apistaging.settlemed.in",
      RPA_USERNAME: "rpa-user",
      RPA_PASSWORD: SECRET,
    },
    fetchImpl(url, init) {
      const parsed = new URL(url);
      calls.push({
        pathname: parsed.pathname,
        userName: parsed.searchParams.get("userName"),
        passwordMatches: parsed.searchParams.get("password") === SECRET,
        isTpa: parsed.searchParams.get("isTpa"),
        isRpa: parsed.searchParams.get("isRpa"),
        registrationId: parsed.searchParams.get("pmjayRegistrationId"),
        documentType: parsed.searchParams.get("documentType"),
        headerMatches: init?.headers?.["rpa-auth-token"] === TOKEN,
      });
      if (parsed.pathname === "/rpa-login") {
        return jsonResponse({ session: { token: TOKEN } });
      }
      if (parsed.pathname === "/rpa-requests") {
        requestAttempts += 1;
        if (requestAttempts === 1) return jsonResponse({}, 500);
        return jsonResponse({ requests: [] });
      }
      return jsonResponse({}, 404);
    },
  });

  const { lines } = await captureConsole(async () => {
    await client.login();
    await client.fetchRequests();
  });

  assert.equal(calls[0].pathname, "/rpa-login");
  assert.equal(calls[0].userName, "rpa-user");
  assert.equal(calls[0].passwordMatches, true);
  assert.equal(calls.filter((call) => call.pathname === "/rpa-requests").length, 2);
  assert.equal(calls[2].isTpa, "1");
  assert.equal(calls[2].isRpa, "true");
  assert.equal(calls[2].headerMatches, true);
  assertNoSecrets(lines);
});

test("a 401 refreshes the token once and retries with the new token", async () => {
  const tokens = ["expired-token-value", "refreshed-token-value"];
  const seenHeaders = [];
  let logins = 0;
  const client = createRpaClient({
    env: {
      RPA_API_BASE: "https://apistaging.settlemed.in",
      RPA_USERNAME: "rpa-user",
      RPA_PASSWORD: SECRET,
    },
    fetchImpl(url, init) {
      const parsed = new URL(url);
      if (parsed.pathname === "/rpa-login") {
        const token = tokens[logins];
        logins += 1;
        return jsonResponse({ session: { token } });
      }
      seenHeaders.push(init.headers["rpa-auth-token"] === tokens[1]);
      if (seenHeaders.length === 1) return jsonResponse({}, 401);
      return jsonResponse({ requests: [] });
    },
  });

  await captureConsole(() => client.fetchRequests());
  assert.equal(logins, 2);
  assert.deepEqual(seenHeaders, [false, true]);
});

test("tpa matching uses the portal host and TpaCreds configuration", () => {
  const volo = matchTpaCase(casePayload(credential({
    tpa: "VOLO HEALTH INSURANCE TPA PVT LTD",
    url: "https://provider.volohealthtpa.com/home",
  })), configuredEntries);
  assert.equal(volo.matched, true);
  assert.equal(volo.portal.id, "volo");
  assert.equal(volo.credentials.portalUrl, "https://provider.volohealthtpa.com/home");

  const epreauth = matchTpaCase(casePayload(credential({
    tpa: "FAMILY HEALTH PLAN TPA PVT. LTD.",
    url: "https://epreauth.fhpl.net/SearchPreauths.aspx",
  })), configuredEntries);
  assert.equal(epreauth.portal.id, "fhpl");

  const star = matchTpaCase(casePayload(credential({
    tpa: "STAR HEALTH AND ALLIED INSURANCE",
    url: "https://provider.ihx.in/",
  }), { payer: "STAR HEALTH AND ALLIED INSURANCE" }), configuredEntries);
  assert.equal(star.matched, false);
  assert.match(star.reason, /no registered automation/);

  const emailOnly = matchTpaCase(casePayload(credential({
    tpa: "VOLO HEALTH INSURANCE TPA PVT LTD",
    url: "user@example.com",
    platform: "email",
  })), configuredEntries);
  assert.equal(emailOnly.matched, false);
});

test("the checked-in TpaCreds list resolves the registered portals only", () => {
  const entries = loadCredentialEntries().map(({ tpaName, portalUrl }) => ({ tpaName, portalUrl }));
  const volo = matchTpaCase(casePayload(credential({
    tpa: "VOLO HEALTH INSURANCE TPA PVT LTD",
    url: "https://provider.volohealthtpa.com/home",
  })), entries);
  const fhpl = matchTpaCase(casePayload(credential({
    tpa: "FAMILY HEALTH PLAN TPA PVT. LTD.",
    url: "https://epreauth.fhpl.net/SearchPreauths.aspx",
  })), entries);
  const star = matchTpaCase(casePayload(credential({
    tpa: "STAR HEALTH AND ALLIED INSURANCE",
    url: "https://provider.ihx.in/",
  })), entries);
  const digit = matchTpaCase(casePayload(credential({
    tpa: "GO DIGIT GENERAL INSURANCE",
    url: "https://first.godigit.com/",
  })), entries);

  assert.equal(volo.portal.id, "volo");
  assert.equal(fhpl.portal.id, "fhpl");
  assert.equal(digit.portal.id, "digit");
  assert.equal(star.matched, false);
});

test("the batch runs matching portals one case at a time and skips the rest", async () => {
  const dispatched = [];
  const caseCalls = [];
  const payloads = {
    111: casePayload(credential({
      tpa: "VOLO HEALTH INSURANCE TPA PVT LTD",
      url: "https://provider.volohealthtpa.com/home",
    }), { registrationId: "111" }),
    222: casePayload(credential({
      tpa: "STAR HEALTH AND ALLIED INSURANCE",
      url: "https://provider.ihx.in/",
    }), { registrationId: "222" }),
    444: casePayload(credential({
      tpa: "FAMILY HEALTH PLAN TPA PVT. LTD.",
      url: "https://epreauth.fhpl.net/SearchPreauths.aspx",
    }), { registrationId: "444" }),
    555: casePayload(credential({
      tpa: "VOLO HEALTH INSURANCE TPA PVT LTD",
      url: "https://provider.volohealthtpa.com/home",
    }), { registrationId: "555" }),
  };
  const client = createRpaClient({
    env: {
      RPA_API_BASE: "https://apistaging.settlemed.in",
      RPA_USERNAME: "rpa-user",
      RPA_PASSWORD: SECRET,
    },
    fetchImpl(url, init) {
      const parsed = new URL(url);
      if (parsed.pathname === "/rpa-login") return jsonResponse({ session: { token: TOKEN } });
      if (parsed.pathname === "/rpa-requests") {
        assert.equal(parsed.searchParams.get("isTpa"), "1");
        assert.equal(parsed.searchParams.get("isRpa"), "true");
        assert.equal(init.headers["rpa-auth-token"], TOKEN);
        return jsonResponse({
          requests: [
            { pmjayRegistrationId: "111", isTpa: true, documentType: "ADMISSIONDOCUMENT" },
            { pmjayRegistrationId: "111", isTpa: true, documentType: "ADMISSIONDOCUMENT" },
            { pmjayRegistrationId: " ", isTpa: true },
            { pmjayRegistrationId: "222", isTpa: true, documentType: "ADMISSIONDOCUMENT" },
            { pmjayRegistrationId: "333", isTpa: true, documentType: "ADMISSIONDOCUMENT" },
            { pmjayRegistrationId: "444", isTpa: true, documentType: "ONDISCHARGEDOCUMENT" },
            { pmjayRegistrationId: "555", isTpa: true, documentType: "ADMISSIONDOCUMENT" },
            { pmjayRegistrationId: "666", isTpa: false, documentType: "ADMISSIONDOCUMENT" },
          ],
        });
      }
      const registrationId = parsed.searchParams.get("pmjayRegistrationId");
      caseCalls.push({
        registrationId,
        documentType: parsed.searchParams.get("documentType"),
        isRpa: parsed.searchParams.get("isRpa"),
        headerMatches: init.headers["rpa-auth-token"] === TOKEN,
      });
      if (registrationId === "333") return jsonResponse({}, 500);
      return jsonResponse(payloads[registrationId]);
    },
  });

  const { result, lines } = await captureConsole(() => runApiBatch({
    client,
    credentialEntries: configuredEntries,
    async dispatchImpl(input) {
      assert.equal(input.credentials.password, SECRET);
      dispatched.push({ tpaId: input.tpaId, caseId: input.caseData.pmjayRegistrationId });
      if (input.caseData.pmjayRegistrationId === "555") {
        throw new Error("portal workflow failed");
      }
    },
  }));

  assert.deepEqual(dispatched, [
    { tpaId: "volo", caseId: "111" },
    { tpaId: "fhpl", caseId: "444" },
    { tpaId: "volo", caseId: "555" },
  ]);
  assert.deepEqual(caseCalls.map((call) => call.registrationId), ["111", "222", "333", "333", "444", "555"]);
  assert.equal(caseCalls.every((call) => call.isRpa === "true" && call.headerMatches), true);
  assert.equal(caseCalls.find((call) => call.registrationId === "444").documentType, "ONDISCHARGEDOCUMENT");
  assert.deepEqual(result, { processed: 2, skipped: 4, failed: 2 });
  assert.match(lines.join("\n"), /Skipping case 222: no registered automation/);
  assert.match(lines.join("\n"), /Case 555 failed/);
  assertNoSecrets(lines);
  assertNoSecrets(dispatched);
});

test("dispatcher passes API credentials to the portal default action", async () => {
  const calls = [];
  const originalVolo = portals.volo.actions.claim;
  const originalFhpl = portals.fhpl.actions.preauth;
  portals.volo.actions.claim = async (input) => calls.push(["volo", input.caseData.pmjayRegistrationId]);
  portals.fhpl.actions.preauth = async (input) => calls.push(["fhpl", input.credentials.username]);
  try {
    await dispatch({
      tpaId: "volo",
      credentials: { username: "api-user", password: SECRET, portalUrl: "https://provider.volohealthtpa.com/home" },
      caseData: { pmjayRegistrationId: "111" },
    });
    await dispatch({
      tpaId: "epreauth",
      credentials: { username: "fhpl-user", password: SECRET, portalUrl: "https://epreauth.fhpl.net/" },
      caseData: { pmjayRegistrationId: "444" },
    });
  } finally {
    portals.volo.actions.claim = originalVolo;
    portals.fhpl.actions.preauth = originalFhpl;
  }
  assert.deepEqual(calls, [["volo", "111"], ["fhpl", "fhpl-user"]]);
});

test("missing API credentials stop before a request is sent", async () => {
  let called = false;
  await assert.rejects(async () => {
    const client = createRpaClient({
      env: { RPA_USERNAME: "rpa-user" },
      fetchImpl() {
        called = true;
        return jsonResponse({});
      },
    });
    await client.login();
  }, /RPA_PASSWORD is required/);
  assert.equal(called, false);
});
