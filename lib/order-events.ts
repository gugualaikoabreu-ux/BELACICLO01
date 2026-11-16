import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;
type OrderEventInput = {
  orderId: string;
  status: "RECEIVED" | "PAYMENT_APPROVED" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  note?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
};

export async function recordOrderEvent(tx: Tx, input: OrderEventInput) {
  const columns = await tx.$queryRaw<Array<{ actorId: boolean; actorEmail: boolean }>>`
    SELECT
      EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.order_events'::regclass AND attname = 'actorId' AND NOT attisdropped) AS "actorId",
      EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.order_events'::regclass AND attname = 'actorEmail' AND NOT attisdropped) AS "actorEmail"
  `;
  const hasActorId = columns[0]?.actorId === true;
  const hasActorEmail = columns[0]?.actorEmail === true;
  const id = randomUUID();

  if (hasActorId && hasActorEmail) {
    await tx.$executeRaw`
      INSERT INTO "order_events" ("id", "orderId", "status", "note", "actorId", "actorEmail", "createdAt")
      VALUES (${id}, ${input.orderId}, ${input.status}::"OrderStatus", ${input.note ?? null}, ${input.actorId ?? null}, ${input.actorEmail ?? null}, NOW())
    `;
  } else if (hasActorId) {
    await tx.$executeRaw`
      INSERT INTO "order_events" ("id", "orderId", "status", "note", "actorId", "createdAt")
      VALUES (${id}, ${input.orderId}, ${input.status}::"OrderStatus", ${input.note ?? null}, ${input.actorId ?? null}, NOW())
    `;
  } else if (hasActorEmail) {
    await tx.$executeRaw`
      INSERT INTO "order_events" ("id", "orderId", "status", "note", "actorEmail", "createdAt")
      VALUES (${id}, ${input.orderId}, ${input.status}::"OrderStatus", ${input.note ?? null}, ${input.actorEmail ?? null}, NOW())
    `;
  } else {
    await tx.$executeRaw`
      INSERT INTO "order_events" ("id", "orderId", "status", "note", "createdAt")
      VALUES (${id}, ${input.orderId}, ${input.status}::"OrderStatus", ${input.note ?? null}, NOW())
    `;
  }
}
