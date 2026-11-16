import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import { resolvePrismaDatasourceUrl } from "./lib/prisma-datasource.ts";

loadEnv({ path: ".env.local" });
loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Generating Prisma Client does not connect to the database. Keep a deploy
  // preview buildable without production credentials; migration commands still
  // require an explicitly configured database URL.
  ...(process.argv.includes("generate") && !process.env.DATABASE_URL && !process.env.DIRECT_DATABASE_URL
    ? {}
    : { datasource: { url: resolvePrismaDatasourceUrl(process.env) } }),
});
