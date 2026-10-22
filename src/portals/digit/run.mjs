import path from "node:path";
import { preparePortalEnv } from "../../shared/credentials.mjs";
import { AutomationError } from "../../shared/errors.mjs";
import { createLogger } from "../../shared/logger.mjs";
import { createPlaywrightSession } from "../../shared/playwright-cli.mjs";
import { root } from "../../shared/paths.mjs";

const log = createLogger("digit");
const loginUrl = "https://first.godigit.com/hospitallogin/#/home";
const sessionName = "digit";
const admissionFlow = path.join(root, "src/portals/digit/admission-flow.js");

function sessionIsOpen(listed, name) {
  const section = listed.match(new RegExp(`- ${name}:\\n([\\s\\S]*?)(?=\\n- |$)`));
  return Boolean(section && /status:\s*open/.test(section[1]));
}

function pageKind(output, snapshotText) {
  const snap = snapshotText(output);
  if (/textbox "Enter OTP"/.test(snap) || /OTP sent successfully/i.test(snap)) return "otp";
  if (/textbox "Phone Number \*"/.test(snap) && /button "Send OTP"/.test(snap)) return "login";
  if (/Invalid OTP|OTP expired|incorrect otp/i.test(snap)) return "rejected";
  return "portal";
}

function ref(text, patterns, label) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  throw new AutomationError(`Could not find ${label} on the page.`, { code: "LOCATOR" });
}

export async function runDigitAdmission() {
  const { run, snapshotText } = createPlaywrightSession(sessionName);
  const identity = preparePortalEnv({
    match: "first.godigit.com",
    baseUrl: loginUrl,
    session: sessionName,
  });
  log.info(`Prepared credentials for ${identity.tpaName} (${identity.username}).`);

  let current = "";
  const listed = run(["list"], { allowFailure: true });
  if (!sessionIsOpen(listed, sessionName)) {
    log.info("Opening the Go Digit hospital login.");
    current = run(["open", loginUrl, "--headed"]);
  } else {
    current = run(["snapshot"]);
    if (/about:blank/.test(current)) {
      current = run(["goto", loginUrl]);
    }
  }

  let kind = pageKind(current, snapshotText);
  if (kind === "rejected") {
    throw new AutomationError("Go Digit rejected the OTP.", { code: "LOGIN" });
  }

  if (kind === "login") {
    log.info("Sending the login OTP.");
    const snap = snapshotText(current);
    const phone = ref(snap, [/textbox "Phone Number \*"[^\n]*\[ref=((?:f\d+)?e\d+)\]/], "Phone Number");
    const send = ref(snap, [/button "Send OTP"[^\n]*\[ref=((?:f\d+)?e\d+)\]/], "Send OTP");
    run(["fill", phone, "LOGIN_USERNAME"]);
    current = run(["click", send]);
    kind = pageKind(current, snapshotText);
  }

  if (kind === "otp") {
    log.info("OTP is on screen. Type the 6-digit OTP in the Chrome window. Login is clicked after 6 digits.");
  }

  log.info("Continuing the admission. The final Submit will not be clicked.");
  const filled = run(["run-code", `--filename=${admissionFlow}`]);
  if (/"errors":\[[^\]]+\]/.test(filled)) {
    throw new AutomationError("The Go Digit admission flow stopped with an error. The browser is still open.", {
      code: "FORM_FIELDS",
    });
  }
  if (/"submitted":true/.test(filled)) {
    throw new AutomationError("The flow clicked the final Submit. That is not allowed.", { code: "SAVE_BLOCKED" });
  }
  if (!/"stoppedAt":"form"/.test(filled)) {
    throw new AutomationError("The flow did not finish the admission form.", { code: "NAVIGATION" });
  }
  log.info("Go Digit admission form filled with dummy data. Final Submit was not clicked.");
}
