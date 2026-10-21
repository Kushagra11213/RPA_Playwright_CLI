import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "node_modules", "@playwright", "cli", "playwright-cli.js");
const session = "-s=smoke";
const screenshot = path.join(root, "artifacts", "smoke", "example.png");
const targetUrl = "https://example.com";

function run(args, { allowFailure = false } = {}) {
  const result = spawnSync(process.execPath, [cli, session, ...args], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (output) {
    process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
  }
  if (result.error) {
    throw result.error;
  }
  if (!allowFailure && result.status !== 0) {
    throw new Error(`playwright-cli ${args.join(" ")} exited with code ${result.status}`);
  }
  return output;
}

mkdirSync(path.dirname(screenshot), { recursive: true });

let opened = false;
try {
  run(["open", targetUrl]);
  opened = true;

  const snapshot = run(["snapshot"]);
  if (!/Page Title: Example Domain/i.test(snapshot) || !/link "Learn more"/i.test(snapshot)) {
    throw new Error("Page snapshot did not include the Example Domain title and Learn more link.");
  }

  const title = run(["eval", "document.title"]);
  if (!/Example Domain/i.test(title)) {
    throw new Error(`Unexpected document title: ${title.trim()}`);
  }

  run([
    "screenshot",
    `--filename=${path.relative(root, screenshot).replaceAll("\\", "/")}`,
  ]);
  if (!existsSync(screenshot) || statSync(screenshot).size === 0) {
    throw new Error(`Screenshot was not written to ${screenshot}`);
  }

  console.log(`Smoke test passed for ${targetUrl}`);
  console.log(`Screenshot: ${screenshot}`);
} finally {
  if (opened) {
    run(["close"], { allowFailure: true });
  }
}
