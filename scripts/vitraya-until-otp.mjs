import { writeFileSync } from "node:fs";
import path from "node:path";
import { solveRecaptchaV2 } from "../src/integrations/capsolver.mjs";
import { createLogger } from "../src/shared/logger.mjs";
import { loadEnv } from "../src/shared/load-env.mjs";
import { createPlaywrightSession } from "../src/shared/playwright-cli.mjs";
import { root } from "../src/shared/paths.mjs";

const log = createLogger("vitraya");
const pageUrl = "https://hospital.vitraya.com/?returnUrl=%2FpreAuth%2Fclaims";
const websiteKey = "6LfaP3YrAAAAAGNzWZAANycKjl1IGt-QP5gPxd1V";
const email = "cmchospital02@gmail.com";

loadEnv();
const { run, snapshotText, refFor } = createPlaywrightSession("vitraya");

function sessionIsOpen(listed) {
  return /-\s+vitraya:[\s\S]*status:\s*open/.test(listed);
}

let current = "";
const listed = run(["list"], { allowFailure: true });
if (!sessionIsOpen(listed)) {
  log.info("Opening the Vitraya hospital login.");
  current = run(["open", pageUrl, "--headed"]);
} else {
  current = run(["snapshot"]);
  if (!/Enter email/.test(snapshotText(current))) {
    current = run(["goto", pageUrl]);
  }
}

log.info("Entering the hospital email.");
const emailRef = refFor(current, [/textbox "Enter email"[^\n]*\[ref=((?:f\d+)?e\d+)\]/], "Enter email");
run(["fill", emailRef, email]);

log.info("Solving the I'm not a robot check before Request OTP.");
const token = await solveRecaptchaV2({ websiteURL: pageUrl, websiteKey });
const applyScript = path.join(root, "artifacts", "vitraya-apply-captcha.js");
writeFileSync(
  applyScript,
  `async page => {
  const token = ${JSON.stringify(token)};
  const applied = await page.evaluate((value) => {
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
    const button = [...document.querySelectorAll("button")].find((item) => /request otp/i.test(item.textContent || ""));
    return { fields: fields.length, callbacks: found.length, requestOtpDisabled: button ? button.disabled : null };
  }, token);
  return applied;
}
`,
  "utf8",
);

const applied = run(["run-code", `--filename=${applyScript}`]);
const state = applied.match(/\{[^{}]*requestOtpDisabled[^{}]*\}/);
run(["screenshot", "--filename=artifacts/vitraya-captcha-solved.png"]);
log.info(`Captcha applied${state ? ` ${state[0]}` : ""}. Request OTP was not clicked.`);
