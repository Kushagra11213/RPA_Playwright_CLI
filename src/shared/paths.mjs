import path from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = path.dirname(fileURLToPath(import.meta.url));

export const root = path.resolve(srcDir, "../..");
export const secretsFile = path.join(root, ".env");
export const credentialsFile = path.join(root, "TpaCreds.json");
