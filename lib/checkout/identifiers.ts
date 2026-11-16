import { createHash } from "node:crypto";

export function createStableOrderNumber(userId: string, idempotencyKey: string) {
  const digest = createHash("sha256").update(`belaciclo:order:${userId}:${idempotencyKey}`).digest("hex").slice(0, 24).toUpperCase();
  return `BC-${digest}`;
}
