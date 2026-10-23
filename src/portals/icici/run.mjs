import { writeFileSync } from "node:fs";
import path from "node:path";
import { fetchEmailOtp } from "../../integrations/email-otp.mjs";
import { preparePortalEnv } from "../../shared/credentials.mjs";
import { AutomationError } from "../../shared/errors.mjs";
import { createLogger } from "../../shared/logger.mjs";
import { createPlaywrightSession } from "../../shared/playwright-cli.mjs";
import { root } from "../../shared/paths.mjs";

const log = createLogger("icici");
const loginUrl = "https://ilhc.icicilombard.com/Home/Login";
const sessionName = "icici";
const preauthFlow = path.join(root, "src/portals/icici/preauth-flow.js");

function sessionIsOpen(listed, name) {
  const section = listed.match(new RegExp(`- ${name}:\\n([\\s\\S]*?)(?=\\n- |$)`));
  return Boolean(section && /status:\s*open/.test(section[1]));
}

function pageKind(output, snapshotText) {
  const snap = snapshotText(output);
  if (/Enter OTP/i.test(snap) && /button "Verify"/i.test(snap)) return "otp";
  if (/textbox "User Name:"/.test(snap) && /button "Login"/i.test(snap)) return "login";
  if (/Invalid User Name or Password/i.test(snap)) return "rejected";
  return "portal";
}

function ref(text, patterns, label) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  throw new AutomationError(`Could not find ${label} on the page.`, { code: "LOCATOR" });
}

function blockDevtool(run) {
  run([
    "route",
    "**/*disable-devtool*",
    "--status=200",
    "--body=",
    "--content-type=application/javascript",
  ]);
}

export async function runIciciPreauth({ credentials } = {}) {
  const { run, snapshotText } = createPlaywrightSession(sessionName);
  const identity = preparePortalEnv({
    match: "ilhc.icicilombard.com",
    baseUrl: loginUrl,
    session: sessionName,
    username: credentials?.username,
    password: credentials?.password,
  });
  log.info(`Prepared credentials for ${identity.tpaName} (${identity.username}).`);

  let current = "";
  const listed = run(["list"], { allowFailure: true });
  if (!sessionIsOpen(listed, sessionName)) {
    log.info("Opening Chrome before the ICICI page so the devtool script can be blocked.");
    run(["open", "about:blank", "--headed"]);
    blockDevtool(run);
    current = run(["goto", loginUrl]);
  } else {
    blockDevtool(run);
    current = run(["snapshot"]);
    if (/about:blank/.test(current)) {
      current = run(["goto", loginUrl]);
    }
  }

  let kind = pageKind(current, snapshotText);
  if (kind === "rejected") {
    run(["dialog-accept"], { allowFailure: true });
    throw new AutomationError("ICICI Lombard rejected the username or password.", { code: "LOGIN" });
  }

  const otpSender = "WEBLOGIN@icicilombard.com";
  let previousOtp = "";
  if (kind === "login") {
    try {
      previousOtp = await fetchEmailOtp(otpSender, { attempts: 1 });
      log.info(`ICICI inbox already has OTP ${previousOtp}. The next code will be used.`);
    } catch {
      previousOtp = "";
    }
    log.info("Signing in.");
    const snap = snapshotText(current);
    const username = ref(snap, [/textbox "User Name:"[^\n]*\[ref=((?:f\d+)?e\d+)\]/], "User Name");
    const password = ref(snap, [/textbox "Password:"[^\n]*\[ref=((?:f\d+)?e\d+)\]/], "Password");
    const login = ref(snap, [/button "Login"[^\n]*\[ref=((?:f\d+)?e\d+)\]/], "Login");
    run(["fill", username, "LOGIN_USERNAME"]);
    run(["fill", password, "LOGIN_PASSWORD"]);
    current = run(["click", login]);
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    for (let attempt = 0; attempt < 8; attempt += 1) {
      run(["dialog-accept"], { allowFailure: true });
      kind = pageKind(current, snapshotText);
      if (kind !== "login") break;
      await pause(1000);
      current = run(["snapshot"]);
    }
    if (/Invalid User Name or Password/i.test(snapshotText(current))) {
      run(["dialog-accept"], { allowFailure: true });
      throw new AutomationError("ICICI Lombard rejected the username or password.", { code: "LOGIN" });
    }
  }

  if (kind === "otp") {
    log.info("Reading the new ICICI OTP from WEBLOGIN@icicilombard.com.");
    const otp = await fetchEmailOtp(otpSender, { untilDifferentFrom: previousOtp, attempts: 12 });
    log.info(`ICICI OTP is ${otp}.`);
    const otpScript = path.join(root, "artifacts", "icici-enter-otp.js");
    writeFileSync(
      otpScript,
      `async page => {
  page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
  const code = ${JSON.stringify(otp)};
  let target = page.mainFrame();
  for (const frame of page.frames()) {
    if (await frame.locator("#txtOTP").isVisible().catch(() => false)) {
      target = frame;
      break;
    }
  }
  const box = target.locator("#txtOTP");
  await box.waitFor({ state: "visible", timeout: 20000 });
  await box.click();
  await box.fill(code);
  let entered = (await box.inputValue()).trim();
  if (entered !== code) {
    await box.fill("");
    await box.pressSequentially(code, { delay: 40 });
    entered = (await box.inputValue()).trim();
  }
  await target.locator("#btnVerify").click();
  await page.waitForTimeout(2500);
  const stillThere = await target.locator("#txtOTP").isVisible().catch(() => false);
  return { entered, leftLogin: !stillThere };
}
`,
      "utf8",
    );
    const submitted = run(["run-code", `--filename=${otpScript}`]);
    if (!/"leftLogin":true/.test(submitted)) {
      throw new AutomationError("ICICI Lombard did not accept the email OTP. The browser is still on the OTP page.", {
        code: "LOGIN",
      });
    }
    log.info("ICICI OTP entered and Verify clicked.");
  }

  log.info("Continuing the IPD preauth. Submit will not be clicked.");
  const filled = run(["run-code", `--filename=${preauthFlow}`]);
  if (/"errors":\[[^\]]+\]/.test(filled)) {
    throw new AutomationError("The ICICI preauth flow stopped with an error. The browser is still open.", {
      code: "FORM_FIELDS",
    });
  }
  if (/"submitted":true/.test(filled)) {
    throw new AutomationError("The flow clicked Submit. That is not allowed.", { code: "SAVE_BLOCKED" });
  }
  if (!/"stoppedAt":"form"/.test(filled)) {
    throw new AutomationError("The flow did not finish the preauth form.", { code: "NAVIGATION" });
  }
  log.info("ICICI preauth form filled with dummy data. Submit was not clicked.");
}
