import type { Prisma } from "@/generated/prisma/client";

export function createPaymentRecord(tx: Prisma.TransactionClient, input: {
  orderId: string;
  provider: string;
  transactionId: string | null;
  amount: number;
  copyPaste: string;
  qrCodeReference: string | null;
  expiresAt: Date;
}) {
  return tx.payment.create({ data: {
    orderId: input.orderId,
    provider: input.provider,
    transactionId: input.transactionId,
    amount: input.amount,
    pixCopyPaste: input.copyPaste,
    qrCodeReference: input.qrCodeReference,
    expiresAt: input.expiresAt,
  } });
}
