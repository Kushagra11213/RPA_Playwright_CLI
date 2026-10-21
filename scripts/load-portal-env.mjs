import { preparePortalEnv } from "../src/shared/credentials.mjs";
import { AutomationError } from "../src/shared/errors.mjs";

const match = (process.argv[2] ?? "").trim();

try {
  const identity = preparePortalEnv({
    match,
    baseUrl: "https://provider.volohealthtpa.com/login",
    session: "volo",
  });
  console.log(`Prepared .env for ${identity.tpaName}`);
  console.log(`Username: ${identity.username}`);
} catch (error) {
  const message = error instanceof AutomationError ? error.message : error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
