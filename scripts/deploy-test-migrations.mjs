import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// The command itself selects test mode, so a missing line in .env.test cannot
// make Prisma fall back to the production DATABASE_URL.
process.env.BELACICLO_TEST_DB_MODE = "true";

const prismaCli = resolve("node_modules/prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  env: process.env,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
