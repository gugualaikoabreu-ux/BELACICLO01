export type PixChargeInput = { amountCents: number; orderNumber: string; expiresAt: Date; customerEmail?: string };
export type PixCharge = { provider: "MANUAL_PIX_STATIC"; transactionId: string; copyPaste: string; qrCodeReference: null; recipientName: string };

export interface PaymentProvider {
  readonly name: string;
  createPixCharge(input: PixChargeInput): Promise<PixCharge>;
}

export class PaymentUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = "PaymentUnavailableError"; }
}
