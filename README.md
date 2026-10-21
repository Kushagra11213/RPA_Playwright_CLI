# TPAFlow

`src/main.mjs` is the file to run for a real request. It asks the APIs which TPA portal to automate, then runs that portal. `rpa-requests` and `tpa-case-date` are not connected yet, so `npm start` stops until those APIs are added.

Test one portal on its own, with no API call:

```powershell
npm run volo:claim
npm run fhpl:preauth
```

A later portal gets its own module, a registry entry, and a script such as `npm run newportal:claim`. The main file picks it up from the registry once the API names that portal.

# Playwright CLI workspace

This project automates browsers with the official [Playwright CLI](https://playwright.dev/docs/getting-started-cli) (`@playwright/cli`). It is a command-line session for coding agents. It does not include the `@playwright/test` runner.

Browser state stays in memory for the life of a session. A session can be saved to disk later with `--persistent` when a workflow needs it.

## Prerequisites

- Node.js 20 or newer (this machine is using the installed Node.js 22)
- npm
- Google Chrome, which this workspace uses by default

## Install

```powershell
npm install
npx playwright-cli install
npx playwright-cli install --skills=agents
```

`npm install` installs the CLI. `playwright-cli install` creates `.playwright/` and selects Chrome when it is installed. `install --skills=agents` copies the command reference to `.agents/skills/playwright-cli` for Cursor and other coding agents.

Firefox, WebKit, or Edge are optional:

```powershell
npx playwright-cli install-browser firefox
npx playwright-cli install-browser webkit
npx playwright-cli install-browser msedge
```

On Linux, system libraries can be installed with `npx playwright-cli install-browser --with-deps`. That flag is not required on Windows.

## Commands

Run these from the project root.

| Script | What it does |
| --- | --- |
| `npm start` | Runs `src/main.mjs`. The API chooses the portal. Not connected yet |
| `npm run volo:claim` | Tests the Volo portal only. Signs in, opens Add Claim, and fills the form without clicking Save Claim |
| `npm run fhpl:preauth` | Tests the FHPL portal only. Signs in, fills the preauth, uploads dummy documents, and does not click Submit |
| `npm run cli:help` | Prints CLI commands |
| `npm run cli -- open https://example.com` | Starts a headless Chrome session and opens a page |
| `npm run cli -- snapshot` | Prints the accessibility snapshot with element refs |
| `npm run cli -- screenshot --filename=artifacts/page.png` | Saves a screenshot |
| `npm run smoke` | Opens `https://example.com`, reads the page, saves a screenshot, and closes |
| `npm run browser:list` | Lists installed browsers |
| `npm run browser:install` | Installs the browser this CLI version needs |
| `npm run session:list` | Lists browser sessions for this workspace |
| `npm run session:close` | Closes every browser session |

The same commands work through the local binary:

```powershell
npx playwright-cli --help
npx playwright-cli open https://example.com
npx playwright-cli snapshot
npx playwright-cli screenshot --filename=artifacts/page.png
npx playwright-cli close
```

Add `--headed` when you want to see the window. The checked-in config runs headless unless that flag is passed.

```powershell
npx playwright-cli open https://example.com --headed
```

## How a session works

1. `open` launches Chrome and keeps it running for later commands.
2. `snapshot` returns element refs such as `e5`.
3. Use those refs to `click`, `fill`, `select`, `check`, or `hover`.
4. Each action returns a fresh snapshot. Refs change, so take a new snapshot before the next click.
5. `close` stops the browser. Headless sessions also stop after one hour without a command.

A named session keeps one site separate from another:

```powershell
npx playwright-cli -s=portal open https://example.com
npx playwright-cli -s=portal snapshot
npx playwright-cli -s=portal close
```

Set `PLAYWRIGHT_CLI_SESSION` when every command in a terminal should use the same name.

Persistent profiles survive a restart. Use that only when the workflow needs it:

```powershell
npx playwright-cli -s=portal open https://example.com --persistent
```

Profile data for persistent sessions is stored under `%LOCALAPPDATA%\ms-playwright\daemon\`, not in this repository. `playwright-cli -s=portal delete-data` removes it.

## Configuration

`.playwright/cli.config.json` is loaded automatically. It selects headless Chrome, an in-memory browser context, a 1280×720 viewport, and `artifacts/` as the output directory.

Copy `.env.example` to `.env` when a real site is ready. The CLI does not read `.env` until you point at it:

```powershell
$env:PLAYWRIGHT_MCP_SECRETS_FILE = ".env"
npx playwright-cli fill e5 LOGIN_PASSWORD
```

`fill` treats `LOGIN_PASSWORD` as a secret name, types the value from `.env`, and redacts that value from the snapshot. Do not pass the password itself on the command line.

After an authorized login, save cookies and localStorage outside git:

```powershell
npx playwright-cli state-save artifacts/auth/storage-state.json
npx playwright-cli state-load artifacts/auth/storage-state.json
```

## Credentials and safety

- Automate only sites and accounts you are authorized to use.
- Keep usernames, passwords, cookies, and tokens out of source files.
- Do not commit `.env`, `artifacts/auth/`, or `.playwright-cli/`.
- Do not store patient information or claim data in this repository.
- If a site shows CAPTCHA, MFA, or another access control, stop and use an authorized manual step or an approved integration. Do not bypass it.

## Project layout

```text
.agents/skills/playwright-cli/   CLI skill and command references
.playwright/cli.config.json      Shared browser configuration
artifacts/                       Screenshots and other generated files
scripts/check-env.mjs            Node, npm, CLI, and browser check
scripts/smoke.mjs                example.com launch and inspection check
.env.example                     Placeholder configuration
package.json                     Dependencies and npm scripts
```

Reusable site workflows belong in `src/` after a URL is provided. None are included yet.

## Next website

In the next prompt, send:

- the exact URL you are authorized to automate
- the workflow to perform, in the order a person would do it
- where the username and password should be read from (environment variables, not the chat), if a login is required
- anything the automation must not click, submit, or change

Do not send passwords, session cookies, or patient information in the prompt.
