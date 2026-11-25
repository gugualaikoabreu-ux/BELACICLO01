"use client";

import { useState } from "react";
import Image from "next/image";
import { formatCurrency, storeConfig } from "@/lib/config";
import { PaymentGuides } from "@/components/payment-guides";

export function PixPayment({ orderNumber, total, copyPaste, recipientKey, recipientName, qrCodeDataUrl, expiresAt }: { orderNumber: string; total: number; copyPaste: string; recipientKey: string; recipientName: string; qrCodeDataUrl: string; expiresAt: string | Date }) {
  const [message, setMessage] = useState("");
  const subject = `Comprovante PIX · pedido ${orderNumber}`;
  const body = `Olá, Bela Ciclo.\n\nSegue o comprovante do pedido ${orderNumber}, no valor de ${formatCurrency(total)}.\n\nO comprovante não substitui a confirmação do crédito pela loja.`;
  const proofEmail = `mailto:${storeConfig.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setMessage(`${label} copiada.`); }
    catch { setMessage(`Não foi possível copiar. Selecione e copie a ${label.toLowerCase()} manualmente.`); }
  }

  return (
    <section className="checkout-status pix-payment" aria-live="polite">
      <div>
        <span className="eyebrow">PEDIDO {orderNumber}</span>
        <h2>PIX manual · aguardando pagamento</h2>
        <p>Faça o PIX no aplicativo do seu banco. Confira o valor e o recebedor antes de confirmar a transferência.</p>
        <p><b>Bela Ciclo · {formatCurrency(total)}</b></p>
        <p>Número do pedido: <b>{orderNumber}</b></p>
        <p>Prazo da reserva: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(expiresAt))}</p>
      </div>
      <Image src={qrCodeDataUrl} unoptimized width={288} height={288} alt={`QR Code PIX do pedido ${orderNumber}`} />
      <div className="pix-copy">
        <p>Recebedor PIX: <b>{recipientName}</b></p>
        <label htmlFor="pix-copy-code">PIX copia e cola · valor já preenchido</label>
        <textarea id="pix-copy-code" readOnly value={copyPaste} rows={4} />
        <button className="button button-dark" type="button" onClick={() => void copy(copyPaste, "Código PIX")}>Copiar código PIX</button>
        <details className="pix-key-fallback">
          <summary>Se o código não funcionar, pagar pela chave Pix</summary>
          <p>No app do banco, escolha Pix por chave e use os dados abaixo. Confira o recebedor e digite exatamente <b>{formatCurrency(total)}</b>. Se houver campo de descrição, informe o pedido {orderNumber}.</p>
          <label htmlFor="pix-recipient-key">Chave Pix da loja</label>
          <input id="pix-recipient-key" readOnly value={recipientKey} />
          <button className="button button-outline" type="button" onClick={() => void copy(recipientKey, "Chave Pix")}>Copiar chave Pix</button>
          <small>Antes de tentar por outro método, confira o extrato para evitar pagar duas vezes. O pagamento é confirmado pela loja após conferência do crédito.</small>
        </details>
        <p className="form-feedback" aria-live="polite">{message}</p>
        <a className="button button-outline" href={proofEmail}>Enviar comprovante por e-mail</a>
        <p className="auth-note">O comprovante não confirma o pagamento. A Bela Ciclo só confirma o pedido depois de verificar o crédito no banco.</p>
      </div>
      <PaymentGuides />
    </section>
  );
}
