import { runVoloClaim } from "../src/portals/volo/run.mjs";
import { AutomationError } from "../src/shared/errors.mjs";

try {
  await runVoloClaim();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (error instanceof AutomationError && error.cause) {
    console.error(error.cause instanceof Error ? error.cause.message : String(error.cause));
  }
  process.exit(1);
}
