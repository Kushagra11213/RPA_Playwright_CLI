import assert from "node:assert/strict";
import test from "node:test";
import { createEmailOtpClient, fetchEmailOtp } from "../src/integrations/email-otp.mjs";

const SECRET = "email-secret-value";
const TOKEN = "email-session-token";
const OTP = "309421";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function clientWith(fetchImpl) {
  return createEmailOtpClient({
    env: {
      EMAIL_OTP_API_BASE: "https://emailautomate.settlemed.ai",
      EMAIL_OTP_EMAIL: "cmchospital02@gmail.com",
      EMAIL_OTP_SECRET: SECRET,
    },
    fetchImpl,
  });
}

test("email otp login sends the session token as the Cookie header", async () => {
  const calls = [];
  const client = clientWith(async (url, init) => {
    const parsed = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({
      method: init.method,
      pathname: parsed.pathname,
      from: parsed.searchParams.get("from"),
      email: body?.email ?? null,
      secretMatches: body?.secret === SECRET,
      cookieMatches: init.headers?.Cookie === `ea_session=${TOKEN}`,
    });
    if (parsed.pathname === "/api/auth/session") {
      return jsonResponse({ ok: true, sessionToken: TOKEN });
    }
    if (parsed.pathname === "/api/sync") return jsonResponse({ ok: true });
    return jsonResponse({ otp: OTP });
  });

  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.map(String).join(" "));
  try {
    const otp = await fetchEmailOtp("WEBLOGIN@icicilombard.com", {
      client,
      attempts: 1,
      sleep: async () => {},
    });
    assert.equal(otp, OTP);
  } finally {
    console.log = original;
  }

  assert.equal(calls[0].pathname, "/api/auth/session");
  assert.equal(calls[0].email, "cmchospital02@gmail.com");
  assert.equal(calls[0].secretMatches, true);
  assert.equal(calls[1].method, "POST");
  assert.equal(calls[1].pathname, "/api/sync");
  assert.equal(calls[1].cookieMatches, true);
  assert.equal(calls[2].pathname, "/api/otp");
  assert.equal(calls[2].from, "WEBLOGIN@icicilombard.com");
  assert.equal(calls[2].cookieMatches, true);
  const logged = lines.join("\n");
  assert.equal(logged.includes(SECRET), false);
  assert.equal(logged.includes(TOKEN), false);
  assert.match(logged, /Email OTP for WEBLOGIN@icicilombard.com: 309421/);
});

test("a 401 refreshes the email session and an empty OTP is polled again", async () => {
  let logins = 0;
  let otpCalls = 0;
  const client = clientWith(async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/api/auth/session") {
      logins += 1;
      return jsonResponse({ sessionToken: logins === 1 ? "expired-token" : TOKEN });
    }
    if (parsed.pathname === "/api/sync") return jsonResponse({ ok: true });
    otpCalls += 1;
    if (otpCalls === 1) return jsonResponse({}, 401);
    if (otpCalls === 2) return jsonResponse({ otp: "" });
    assert.equal(parsed.searchParams.get("from"), "noreply@godigit.com");
    return jsonResponse({ otp: OTP });
  });

  const otp = await fetchEmailOtp("noreply@godigit.com", {
    client,
    attempts: 3,
    sleep: async () => {},
  });
  assert.equal(otp, OTP);
  assert.equal(logins, 2);
});
