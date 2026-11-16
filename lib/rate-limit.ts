import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";

export async function enforceRateLimit(scope: string, ip: string, limit: number, windowSeconds: number) {
  const db = getDb();
  const anonymousKey = createHash("sha256").update(ip || "unknown").digest("hex");
  const key = `${scope}:${anonymousKey}`;
  const rows = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "rate_limit_buckets" ("key", "count", "windowStartedAt")
    VALUES (${key}, 1, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rate_limit_buckets"."windowStartedAt" < NOW() - (${windowSeconds} * INTERVAL '1 second') THEN 1 ELSE "rate_limit_buckets"."count" + 1 END,
      "windowStartedAt" = CASE WHEN "rate_limit_buckets"."windowStartedAt" < NOW() - (${windowSeconds} * INTERVAL '1 second') THEN NOW() ELSE "rate_limit_buckets"."windowStartedAt" END
    RETURNING "count"
  `;
  return (rows[0]?.count ?? 0) <= limit;
}

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}
