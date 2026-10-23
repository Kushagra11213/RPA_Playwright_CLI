import { writeFileSync } from "node:fs";
import path from "node:path";
import { fetchEmailOtp } from "../../integrations/email-otp.mjs";
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

export async function runDigitAdmission({ credentials } = {}) {
  const { run, snapshotText } = createPlaywrightSession(sessionName);
  const identity = preparePortalEnv({
    match: "first.godigit.com",
    baseUrl: loginUrl,
    session: sessionName,
    username: credentials?.username,
    password: credentials?.password,
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
    log.info("Reading the Go Digit OTP from noreply@godigit.com.");
    const otp = await fetchEmailOtp("noreply@godigit.com");
    log.info(`Go Digit OTP is ${otp}.`);
    const otpScript = path.join(root, "artifacts", "digit-enter-otp.js");
    writeFileSync(
      otpScript,
      `async page => {
  const box = page.getByRole("textbox", { name: "Enter OTP" });
  await box.waitFor({ state: "visible", timeout: 20000 });
  await box.click();
  await box.fill(${JSON.stringify(otp)});
  let entered = (await box.inputValue()).trim();
  if (entered !== ${JSON.stringify(otp)}) {
    await box.fill("");
    await box.pressSequentially(${JSON.stringify(otp)}, { delay: 40 });
    entered = (await box.inputValue()).trim();
  }
  await page.getByRole("button", { name: /^Login$/ }).click();
  await page.waitForURL((url) => !String(url).includes("accounts.godigit.com"), { timeout: 30000 }).catch(() => {});
  return { entered, leftLogin: !page.url().includes("accounts.godigit.com") };
}
`,
      "utf8",
    );
    const submitted = run(["run-code", `--filename=${otpScript}`]);
    if (!/"leftLogin":true/.test(submitted)) {
      throw new AutomationError("Go Digit did not accept the email OTP. The browser is still on the OTP page.", {
        code: "LOGIN",
      });
    }
    log.info("Go Digit OTP entered and Login clicked.");
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
