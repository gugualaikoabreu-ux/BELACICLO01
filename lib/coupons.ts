import type { Prisma } from "@/generated/prisma/client";

type CouponTerms = {
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  discountBps: number | null;
  discountCents: number | null;
  minimumSubtotalCents: number | null;
  usageLimit: number | null;
  usedCount: number;
};

export type CouponQuote = { code: string; discountCents: number; subtotalCents: number; discountedSubtotalCents: number };

export class CouponUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = "CouponUnavailableError"; }
}

async function hasCouponRedemptionsTable(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<Array<{ available: boolean }>>`
    SELECT to_regclass('public.coupon_redemptions') IS NOT NULL AS available
  `;
  return rows[0]?.available === true;
}

export function normalizeCouponCode(value: string) {
  return value.trim().toUpperCase();
}

export function getCouponValidationError(coupon: CouponTerms, subtotalCents: number, now = new Date()) {
  if (!coupon.active) return "Este cupom não está ativo.";
  if (coupon.startsAt && coupon.startsAt > now) return "Este cupom ainda não começou a valer.";
  if (coupon.endsAt && coupon.endsAt <= now) return "Este cupom expirou.";
  if (coupon.minimumSubtotalCents !== null && subtotalCents < coupon.minimumSubtotalCents) return "O subtotal mínimo para este cupom ainda não foi atingido.";
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return "Este cupom atingiu o limite de utilizações.";
  if ((coupon.discountBps !== null) === (coupon.discountCents !== null)) return "A configuração deste cupom é inválida.";
  return null;
}

export function calculateCouponDiscountCents(coupon: Pick<CouponTerms, "discountBps" | "discountCents">, subtotalCents: number) {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents <= 0) return 0;
  const amount = coupon.discountBps !== null
    ? Math.floor(subtotalCents * coupon.discountBps / 10_000)
    : coupon.discountCents ?? 0;
  return Math.min(subtotalCents, Math.max(0, amount));
}

export async function lockAndValidateCoupon(
  tx: Prisma.TransactionClient,
  input: { code: string; userId: string; subtotalCents: number; now?: Date },
): Promise<CouponQuote & { couponId: string; usageLimit: number | null }> {
  if (!await hasCouponRedemptionsTable(tx)) {
    throw new CouponUnavailableError("Cupons estão temporariamente indisponíveis. Tente novamente sem cupom.");
  }
  const code = normalizeCouponCode(input.code);
  const now = input.now ?? new Date();
  const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "coupons" WHERE "code" = ${code} FOR UPDATE`;
  if (!locked.length) throw new CouponUnavailableError("Cupom não encontrado ou indisponível.");
  const coupon = await tx.coupon.findUnique({ where: { code } });
  if (!coupon) throw new CouponUnavailableError("Cupom não encontrado ou indisponível.");
  const issue = getCouponValidationError(coupon, input.subtotalCents, now);
  if (issue) throw new CouponUnavailableError(issue);
  const priorUse = await tx.couponRedemption.findFirst({
    where: { couponId: coupon.id, userId: input.userId, status: { in: ["RESERVED", "REDEEMED"] } },
    select: { id: true },
  });
  if (priorUse) throw new CouponUnavailableError("Esta conta já reservou ou utilizou este cupom.");
  const discountCents = calculateCouponDiscountCents(coupon, input.subtotalCents);
  if (discountCents < 1) throw new CouponUnavailableError("O desconto deste cupom não se aplica a este pedido.");
  return { couponId: coupon.id, code: coupon.code, usageLimit: coupon.usageLimit, discountCents, subtotalCents: input.subtotalCents, discountedSubtotalCents: input.subtotalCents - discountCents };
}

export async function reserveCouponForOrder(
  tx: Prisma.TransactionClient,
  input: { couponId: string; couponCode: string; orderId: string; userId: string; discountCents: number; usageLimit: number | null; now?: Date },
) {
  const now = input.now ?? new Date();
  if (!await hasCouponRedemptionsTable(tx)) {
    throw new CouponUnavailableError("Cupons estão temporariamente indisponíveis. Tente novamente sem cupom.");
  }
  const incremented = await tx.coupon.updateMany({
    where: { id: input.couponId, ...(input.usageLimit === null ? {} : { usedCount: { lt: input.usageLimit } }) },
    data: { usedCount: { increment: 1 } },
  });
  if (!incremented.count) throw new CouponUnavailableError("Este cupom atingiu o limite de utilizações. Atualize o checkout.");
  await tx.couponRedemption.create({
    data: { couponId: input.couponId, couponCode: input.couponCode, orderId: input.orderId, userId: input.userId, discountCents: input.discountCents, status: "RESERVED", reservedAt: now },
  });
}

export async function redeemCouponForOrder(tx: Prisma.TransactionClient, orderId: string, now = new Date()) {
  if (!await hasCouponRedemptionsTable(tx)) return;
  const redemption = await tx.couponRedemption.findUnique({ where: { orderId }, select: { id: true } });
  if (!redemption) return;
  await tx.couponRedemption.updateMany({ where: { id: redemption.id, status: "RESERVED" }, data: { status: "REDEEMED", redeemedAt: now } });
}

export async function releaseCouponForOrder(tx: Prisma.TransactionClient, orderId: string, now = new Date()) {
  if (!await hasCouponRedemptionsTable(tx)) return;
  const redemption = await tx.couponRedemption.findUnique({ where: { orderId }, select: { id: true, couponId: true } });
  if (!redemption) return;
  const released = await tx.couponRedemption.updateMany({ where: { id: redemption.id, status: "RESERVED" }, data: { status: "RELEASED", releasedAt: now } });
  if (!released.count) return;
  const decremented = await tx.coupon.updateMany({ where: { id: redemption.couponId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
  if (!decremented.count) throw new Error("Contador de utilizações do cupom inconsistente.");
}
