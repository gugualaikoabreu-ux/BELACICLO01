import { getManualPixKey, getManualPixMerchantName, ManualPixProvider } from "./manual-pix-provider.ts";

export async function renderPixQrCodeDataUrl(copyPaste: string) {
  const { default: QRCode } = await import("qrcode");
  return QRCode.toDataURL(copyPaste, { errorCorrectionLevel: "M", margin: 2, width: 288 });
}

export function getConfiguredPaymentProvider() {
  return new ManualPixProvider();
}

export function getManualPixRecipientKey() {
  return getManualPixKey();
}

export function getManualPixRecipientName() {
  return getManualPixMerchantName();
}

export async function createPixPayment(amountCents: number, orderNumber: string, expiresAt: Date, customerEmail?: string) {
  const charge = await getConfiguredPaymentProvider().createPixCharge({ amountCents, orderNumber, expiresAt, customerEmail });
  const qrCodeDataUrl = await renderPixQrCodeDataUrl(charge.copyPaste);
  return { ...charge, qrCodeDataUrl };
}
