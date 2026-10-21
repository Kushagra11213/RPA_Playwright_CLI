import path from "node:path";
import { preparePortalEnv } from "../../shared/credentials.mjs";
import { AutomationError } from "../../shared/errors.mjs";
import { createLogger } from "../../shared/logger.mjs";
import { createPlaywrightSession } from "../../shared/playwright-cli.mjs";
import { root } from "../../shared/paths.mjs";

const log = createLogger("volo");
const loginUrl = "https://provider.volohealthtpa.com/login";
const sessionName = "volo";
const claimFlow = path.join(root, "src/portals/volo/claim-flow.js");

function sessionIsOpen(listed, name) {
  const section = listed.match(new RegExp(`- ${name}:\\n([\\s\\S]*?)(?=\\n- |$)`));
  return Boolean(section && /status:\s*open/.test(section[1]));
}

function pageKind(output, snapshotText) {
  const snap = snapshotText(output);
  if (/already Logged-in/i.test(snap)) {
    return "busy";
  }
  if (/heading "New claim"|New claim/.test(snap) && /Enter Member Id/.test(snap)) {
    return "claim";
  }
  if (/Add new Claim/.test(snap)) {
    return "home";
  }
  if (/Sign in/.test(snap)) {
    return "login";
  }
  return "unknown";
}

export async function runVoloClaim() {
  const { run, snapshotText, refFor } = createPlaywrightSession(sessionName);
  const identity = preparePortalEnv({
    match: "volohealthtpa.com",
    baseUrl: loginUrl,
    session: sessionName,
  });
  log.info(`Prepared credentials for ${identity.tpaName} (${identity.username}).`);

  let current = "";
  const listed = run(["list"], { allowFailure: true });
  if (sessionIsOpen(listed, sessionName)) {
    current = run(["snapshot"]);
  } else {
    log.info("Opening the Volo login page in Chrome.");
    current = run(["open", loginUrl, "--headed"]);
  }

  let kind = pageKind(current, snapshotText);
  if (kind === "unknown") {
    current = run(["goto", loginUrl]);
    kind = pageKind(current, snapshotText);
  }

  if (kind === "login" || kind === "busy") {
    if (kind === "busy") {
      const ok = refFor(current, [/button "OK"[^\n]*\[ref=(e\d+)\]/], "OK");
      current = run(["click", ok]);
    } else {
      const ok = snapshotText(current).match(/button "OK"[^\n]*\[ref=(e\d+)\]/);
      if (ok) {
        current = run(["click", ok[1]]);
      }
    }
    log.info("Signing in.");
    const username = refFor(
      current,
      [/textbox "User Name"[^\n]*\[ref=(e\d+)\]/, /textbox \[ref=(e\d+)\]:\r?\n\s*- \/placeholder: User Name/],
      "User Name",
    );
    const password = refFor(
      current,
      [/textbox "Password"[^\n]*\[ref=(e\d+)\]/, /textbox \[ref=(e\d+)\]:[^\n]*LOGIN_PASSWORD/],
      "Password",
    );
    const signIn = refFor(
      current,
      [/button "Sign in"[^\n]*\[ref=(e\d+)\]/, /button \[ref=(e\d+)\][^\n]*Sign in/],
      "Sign in",
    );
    run(["fill", username, "LOGIN_USERNAME"]);
    run(["fill", password, "LOGIN_PASSWORD"]);
    current = run(["click", signIn]);
    kind = pageKind(current, snapshotText);
    if (kind === "busy") {
      const ok = refFor(current, [/button "OK"[^\n]*\[ref=(e\d+)\]/], "OK");
      run(["click", ok]);
      throw new AutomationError(
        "Volo still has this user signed in from another browser session. Log out there, or wait for that session to expire, then run npm run volo:claim again.",
        { code: "SESSION_BUSY" },
      );
    }
    if (kind !== "home" && kind !== "claim") {
      const snap = snapshotText(current);
      const dialog = snap.match(/dialog[\s\S]*?\n\s*- generic \[ref=e\d+\]: ([^\n]+)/);
      const message = dialog?.[1]?.trim();
      if (message) {
        const ok = snap.match(/button "OK"[^\n]*\[ref=(e\d+)\]/);
        if (ok) {
          run(["click", ok[1]]);
        }
        throw new AutomationError(`Volo sign-in stopped: ${message}`, { code: "PORTAL_DIALOG" });
      }
    }
  }

  if (kind === "home") {
    log.info("Opening Add Claim.");
    const addClaim = refFor(current, [/button "Add new Claim"[^\n]*\[ref=(e\d+)\]/], "Add Claim");
    const claimPage = run(["click", addClaim]);
    if (pageKind(claimPage, snapshotText) !== "claim" && !/claim-initiation/.test(claimPage)) {
      throw new AutomationError("Add Claim did not open the new-claim form.", { code: "NAVIGATION" });
    }
    kind = "claim";
  }

  if (kind !== "claim") {
    throw new AutomationError("The flow did not reach the new-claim form.", { code: "NAVIGATION" });
  }

  log.info("Filling the claim form. Save Claim will not be clicked.");
  const filled = run(["run-code", `--filename=${claimFlow}`]);
  if (/"saved":true/.test(filled)) {
    throw new AutomationError("The flow clicked Save Claim. That is not allowed.", { code: "SAVE_BLOCKED" });
  }
  const errorMatch = filled.match(/"errors":\[(.*?)\]/s);
  if (errorMatch && errorMatch[1].trim()) {
    throw new AutomationError("The form was filled with some field errors. The browser is still open.", {
      code: "FORM_FIELDS",
    });
  }
  log.info("Claim form filled. Save Claim was not clicked. The browser is still open.");
}
