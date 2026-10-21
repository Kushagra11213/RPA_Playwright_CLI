import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "node_modules", "@playwright", "cli", "playwright-cli.js");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, { shell = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    shell,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      output || `${command} ${args.join(" ")} exited with code ${result.status}`,
    );
  }
  return output;
}

const major = Number(process.versions.node.split(".")[0]);
console.log(`Node.js ${process.version}`);
if (major < 20) {
  console.error("Node.js 20 or newer is required.");
  process.exit(1);
}

const npmVersion = run(npmCommand, ["-v"], { shell: true });
console.log(`npm ${npmVersion}`);

const cliVersion = run(process.execPath, [cli, "--version"]);
console.log(`playwright-cli ${cliVersion}`);

const chrome = run(process.execPath, [cli, "install-browser", "chrome", "--dry-run"]);
console.log(chrome);

if (!/Install location:\s+<system>/i.test(chrome)) {
  console.error("Google Chrome was not found. This workspace launches the installed Chrome channel.");
  process.exit(1);
}

console.log("Environment check passed.");
