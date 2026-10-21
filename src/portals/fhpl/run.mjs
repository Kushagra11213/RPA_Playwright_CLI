import path from "node:path";
import { preparePortalEnv } from "../../shared/credentials.mjs";
import { AutomationError } from "../../shared/errors.mjs";
import { createLogger } from "../../shared/logger.mjs";
import { createPlaywrightSession } from "../../shared/playwright-cli.mjs";
import { root } from "../../shared/paths.mjs";

const log = createLogger("fhpl");
const loginUrl = "https://epreauth.fhpl.net/Login.aspx";
const formUrl = "https://epreauth.fhpl.net/PreauthRequest.aspx";
const sessionName = "fhpl";
const preauthFlow = path.join(root, "src/portals/fhpl/preauth-flow.js");

function pageKind(output, snapshotText) {
  const snap = snapshotText(output);
  if (/Oops|Something went wrong/i.test(snap)) return "error";
  if (/PREAUTH REQUEST/.test(snap) && /Insurance Company/.test(snap)) return "form";
  if (/New PreauthRequest/.test(snap)) return "home";
  if (/User Name/.test(snap) && /button "Login"/.test(snap)) return "login";
  return "unknown";
}

function ref(text, patterns, label) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  throw new AutomationError(`Could not find ${label} on the page.`, { code: "LOCATOR" });
}

export async function runFhplPreauth() {
  const { run, snapshotText } = createPlaywrightSession(sessionName);
  const identity = preparePortalEnv({
    match: "epreauth.fhpl.net",
    baseUrl: loginUrl,
    session: sessionName,
  });
  log.info(`Prepared credentials for ${identity.tpaName} (${identity.username}).`);

  let current = "";
  const listed = run(["list"], { allowFailure: true });
  if (/status:\s*open/.test(listed)) {
    log.info("Opening the FHPL preauth form in the existing Chrome window.");
    current = run(["goto", formUrl]);
  } else {
    log.info("Opening the FHPL login page in Chrome.");
    current = run(["open", loginUrl, "--headed"]);
  }

  let kind = pageKind(current, snapshotText);
  if (kind === "error" || kind === "unknown") {
    current = run(["goto", loginUrl]);
    kind = pageKind(current, snapshotText);
  }

  if (kind === "login") {
    log.info("Signing in.");
    const snap = snapshotText(current);
    const username = ref(snap, [/cell "User Name"[\s\S]*?textbox \[ref=((?:f\d+)?e\d+)\]/], "User Name");
    const password = ref(snap, [/cell "Password"[\s\S]*?textbox \[ref=((?:f\d+)?e\d+)\]/], "Password");
    const login = ref(snap, [/button "Login"[^\n]*\[ref=((?:f\d+)?e\d+)\]/], "Login");
    run(["fill", username, "LOGIN_USERNAME"]);
    run(["fill", password, "LOGIN_PASSWORD"]);
    current = run(["click", login]);
    kind = pageKind(current, snapshotText);
  }

  if (kind === "home") {
    log.info("Opening New Preauth Request.");
    const snap = snapshotText(current);
    const create = ref(snap, [/link "New PreauthRequest"[^\n]*\[ref=((?:f\d+)?e\d+)\]/], "New PreauthRequest");
    current = run(["click", create]);
    kind = pageKind(current, snapshotText);
  }

  if (kind !== "form") {
    throw new AutomationError("The flow did not reach the new preauth form.", { code: "NAVIGATION" });
  }

  log.info("Filling the preauth form through Add Documents. Submit will not be clicked.");
  const filled = run(["run-code", `--filename=${preauthFlow}`]);
  if (/"errors":\[[^\]]+\]/.test(filled)) {
    throw new AutomationError("The FHPL preauth form stopped with a field error. The browser is still open.", {
      code: "FORM_FIELDS",
    });
  }
  if (!/"stoppedAt":"Add Documents"/.test(filled)) {
    throw new AutomationError("The flow did not stop on Add Documents.", { code: "NAVIGATION" });
  }
  log.info("FHPL dummy documents are uploaded. Final bill is Yes, DOD is filled, and Submit was not clicked.");
}
