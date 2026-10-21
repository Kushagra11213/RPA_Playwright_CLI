import path from "node:path";
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

export async function runIciciPreauth() {
  const { run, snapshotText } = createPlaywrightSession(sessionName);
  const identity = preparePortalEnv({
    match: "ilhc.icicilombard.com",
    baseUrl: loginUrl,
    session: sessionName,
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

  if (kind === "login") {
    log.info("Signing in.");
    const snap = snapshotText(current);
    const username = ref(snap, [/textbox "User Name:"[^\n]*\[ref=((?:f\d+)?e\d+)\]/], "User Name");
    const password = ref(snap, [/textbox "Password:"[^\n]*\[ref=((?:f\d+)?e\d+)\]/], "Password");
    const login = ref(snap, [/button "Login"[^\n]*\[ref=((?:f\d+)?e\d+)\]/], "Login");
    run(["fill", username, "LOGIN_USERNAME"]);
    run(["fill", password, "LOGIN_PASSWORD"]);
    current = run(["click", login]);
    if (/Invalid User Name or Password/i.test(current)) {
      run(["dialog-accept"], { allowFailure: true });
      throw new AutomationError("ICICI Lombard rejected the username or password.", { code: "LOGIN" });
    }
    kind = pageKind(current, snapshotText);
  }

  if (kind === "otp") {
    log.info("OTP is on screen. Type it in the Chrome window. Verify is clicked after 6 digits.");
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
