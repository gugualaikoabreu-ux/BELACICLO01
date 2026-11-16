import { buildStaticPixPayload } from "../pix/brcode.ts";
import { PaymentUnavailableError, type PaymentProvider, type PixChargeInput, type PixCharge } from "./provider.ts";

export function getManualPixKey() {
  const key = process.env.PIX_STATIC_KEY?.trim();
  if (!key) throw new PaymentUnavailableError("Configure a chave PIX autorizada no ambiente seguro da loja.");
  return key;
}

export function getManualPixMerchantName() {
  const name = process.env.PIX_MERCHANT_NAME?.trim();
  if (!name) throw new PaymentUnavailableError("Configure o nome do titular da chave PIX no ambiente seguro da loja.");
  return name;
}

export class ManualPixProvider implements PaymentProvider {
  readonly name = "MANUAL_PIX_STATIC";

  async createPixCharge(input: PixChargeInput): Promise<PixCharge> {
    const key = getManualPixKey();
    const merchantName = getManualPixMerchantName();
    const merchantCity = process.env.PIX_MERCHANT_CITY?.trim();
    if (process.env.PIX_MODE !== "manual") throw new PaymentUnavailableError("A BelaCiclo aceita exclusivamente PIX manual. Configure PIX_MODE=manual no ambiente seguro da loja.");
    if (!merchantCity) throw new PaymentUnavailableError("Configure a cidade, conforme os dados bancários da conta recebedora.");

    const txid = `BC${input.orderNumber.replace(/[^a-z0-9]/gi, "").toUpperCase()}`.slice(0, 25);
    const copyPaste = buildStaticPixPayload({ key, merchantName, merchantCity }, input.amountCents, txid);
    return { provider: this.name, transactionId: txid, copyPaste, qrCodeReference: null, recipientName: merchantName };
  }
}
