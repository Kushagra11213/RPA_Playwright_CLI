import { writeFileSync } from "node:fs";
import path from "node:path";
import { solveRecaptchaV2 } from "../src/integrations/capsolver.mjs";
import { fetchEmailOtp } from "../src/integrations/email-otp.mjs";
import { AutomationError } from "../src/shared/errors.mjs";
import { createLogger } from "../src/shared/logger.mjs";
import { loadEnv } from "../src/shared/load-env.mjs";
import { createPlaywrightSession } from "../src/shared/playwright-cli.mjs";
import { root } from "../src/shared/paths.mjs";

const log = createLogger("vitraya");
const pageUrl = "https://hospital.vitraya.com/?returnUrl=%2FpreAuth%2Fclaims";
const email = "cmchospital02@gmail.com";
const otpSender = "no-reply@vitraya.com";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

loadEnv();
const { run, snapshotText, refFor } = createPlaywrightSession("vitraya");

function sessionIsOpen(listed) {
  return /-\s+vitraya:[\s\S]*status:\s*open/.test(listed);
}

function resultObject(output) {
  const match = output.match(/### Result\s*(\{.*\})/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function runPage(filename) {
  const output = run(["run-code", `--filename=${filename}`]);
  return { output, result: resultObject(output) };
}

function writePage(name, source) {
  const filename = path.join(root, "artifacts", name);
  writeFileSync(filename, source, "utf8");
  return filename;
}

function applyCaptcha(token) {
  const filename = writePage(
    "vitraya-apply-captcha.js",
    `async page => {
  const token = ${JSON.stringify(token)};
  return page.evaluate((value) => {
    const fields = [...document.querySelectorAll('textarea[name="g-recaptcha-response"], #g-recaptcha-response')];
    for (const field of fields) {
      field.value = value;
      field.innerHTML = value;
    }
    const visited = new Set();
    const found = [];
    const walk = (node, depth) => {
      if (!node || typeof node !== "object" || visited.has(node) || depth > 8) return;
      visited.add(node);
      for (const key of Object.keys(node)) {
        let child;
        try { child = node[key]; } catch { continue; }
        if (typeof child === "function" && /callback/i.test(key)) found.push(child);
        else walk(child, depth + 1);
      }
    };
    walk(window.___grecaptcha_cfg?.clients, 0);
    for (const callback of found) {
      try { callback(value); } catch {}
    }
    const button = [...document.querySelectorAll("button")].find((item) => /request otp|verify otp/i.test(item.textContent || ""));
    return { fields: fields.length, requestOtpDisabled: button ? button.disabled : null, buttonText: button ? button.textContent.trim() : "" };
  }, token);
}
`,
  );
  return runPage(filename).result;
}

function readSiteKey() {
  const filename = writePage(
    "vitraya-sitekey.js",
    `async page => page.evaluate(() => {
  const frame = [...document.querySelectorAll("iframe")].map((item) => item.src).find((src) => src.includes("recaptcha/api2/anchor"));
  if (!frame) return "";
  return new URL(frame).searchParams.get("k") || "";
})
`,
  );
  const output = run(["run-code", `--filename=${filename}`]);
  const match = output.match(/### Result\s+"([^"]+)"/);
  return match?.[1] ?? "";
}

let current = "";
const listed = run(["list"], { allowFailure: true });
if (!sessionIsOpen(listed)) {
  log.info("Opening the Vitraya hospital login.");
  current = run(["open", pageUrl, "--headed"]);
} else {
  log.info("Reloading the Vitraya hospital login.");
  current = run(["goto", pageUrl]);
}

log.info("Entering the hospital email.");
const emailRef = refFor(current, [/textbox "Enter email"[^\n]*\[ref=((?:f\d+)?e\d+)\]/], "Enter email");
run(["fill", emailRef, email]);

let previousOtp = "";
try {
  previousOtp = await fetchEmailOtp(otpSender, { attempts: 1 });
  log.info(`Vitraya inbox already has OTP ${previousOtp}. The next code will be used.`);
} catch {
  previousOtp = "";
}

const websiteKey = readSiteKey();
if (!websiteKey) {
  throw new AutomationError("The Vitraya reCAPTCHA site key was not on the page.", { code: "CAPTCHA" });
}
log.info("Solving the login reCAPTCHA.");
const loginToken = await solveRecaptchaV2({ websiteURL: pageUrl, websiteKey });
const loginState = applyCaptcha(loginToken);
log.info(`Login captcha applied. Request OTP disabled=${loginState?.requestOtpDisabled}.`);
if (loginState?.requestOtpDisabled !== false) {
  throw new AutomationError("Request OTP stayed disabled after the captcha solve.", { code: "CAPTCHA" });
}

log.info("Clicking Request OTP.");
const requestScript = writePage(
  "vitraya-request-otp.js",
  `async page => {
  const button = page.getByRole("button", { name: /request otp/i });
  await button.click();
  await page.waitForTimeout(1500);
  return { url: page.url() };
}
`,
);
runPage(requestScript);

let verifySnap = "";
for (let attempt = 0; attempt < 15; attempt += 1) {
  verifySnap = snapshotText(run(["snapshot"]));
  if (/verify otp/i.test(verifySnap) || /enter otp/i.test(verifySnap) || /textbox[^\n]*OTP/i.test(verifySnap)) break;
  await pause(1000);
}
if (!/otp/i.test(verifySnap)) {
  throw new AutomationError("The Verify OTP screen did not open.", { code: "NAVIGATION" });
}
log.info("Verify OTP screen is open.");

const otp = await fetchEmailOtp(otpSender, { untilDifferentFrom: previousOtp, attempts: 12 });
log.info(`Vitraya OTP is ${otp}.`);

const fillScript = writePage(
  "vitraya-fill-otp.js",
  `async page => {
  const code = ${JSON.stringify(otp)};
  const box = page.getByRole("textbox", { name: /otp/i }).last();
  await box.click();
  await box.fill(code);
  let entered = (await box.inputValue()).trim();
  if (entered !== code) {
    await box.fill("");
    await box.pressSequentially(code, { delay: 40 });
    entered = (await box.inputValue()).trim();
  }
  return { entered };
}
`,
);
const filled = runPage(fillScript).result;
if (!filled?.entered) {
  throw new AutomationError("The Vitraya OTP was not typed into the verify box.", { code: "OTP" });
}

const verifyKey = readSiteKey() || websiteKey;
log.info("Solving the verify-screen reCAPTCHA.");
const verifyToken = await solveRecaptchaV2({ websiteURL: pageUrl, websiteKey: verifyKey });
const verifyState = applyCaptcha(verifyToken);
log.info(`Verify captcha applied. Button disabled=${verifyState?.requestOtpDisabled} text=${verifyState?.buttonText}.`);

log.info("Clicking Verify OTP.");
const verifyScript = writePage(
  "vitraya-click-verify.js",
  `async page => {
  const button = page.getByRole("button", { name: /verify otp/i });
  await button.click();
  await page.waitForTimeout(2000);
  return { url: page.url(), title: await page.title() };
}
`,
);
runPage(verifyScript);
run(["screenshot", "--filename=artifacts/vitraya-otp-verified.png"]);
log.info("Verify OTP was clicked. Stopped here.");
