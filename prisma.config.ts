import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import { resolvePrismaDatasourceUrl } from "./lib/prisma-datasource.ts";

loadEnv({ path: ".env.local" });
loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: resolvePrismaDatasourceUrl(process.env) },
});
