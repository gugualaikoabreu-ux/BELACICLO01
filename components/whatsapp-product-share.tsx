"use client";

import { Icon } from "@/components/icons";
import { storeConfig } from "@/lib/config";

function WhatsAppBrandMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.52 3.48A11.82 11.82 0 0 0 12.1 0C5.55 0 .22 5.33.22 11.88c0 2.09.55 4.14 1.6 5.95L.13 24l6.34-1.66a11.9 11.9 0 0 0 5.63 1.43h.01c6.55 0 11.88-5.33 11.89-11.88a11.82 11.82 0 0 0-3.48-8.41ZM12.1 21.75h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.22-3.76.99 1-3.66-.24-.38a9.85 9.85 0 0 1-1.52-5.22c0-5.46 4.45-9.9 9.92-9.9a9.84 9.84 0 0 1 7.02 2.91 9.84 9.84 0 0 1 2.9 7.01c0 5.46-4.45 9.9-9.92 9.9Zm5.44-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.49-.9-.79-1.5-1.77-1.68-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.63-.93-2.23-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.53.08-.8.38-.28.3-1.05 1.02-1.05 2.49s1.08 2.89 1.23 3.09c.15.2 2.11 3.22 5.1 4.52.71.31 1.27.5 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.77-.73 2.02-1.43.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z"/></svg>;
}

export function WhatsAppProductShare({ productName, productPrice, productSlug, imageUrl }: {
  productName: string;
  productPrice: string;
  productSlug: string;
  imageUrl?: string;
}) {
  function shareProduct() {
    const origin = window.location.origin;
    const productUrl = new URL(`/produto/${encodeURIComponent(productSlug)}`, origin).toString();
    const photoUrl = imageUrl ? new URL(imageUrl, origin).toString() : "";
    const phone = storeConfig.whatsappUrl.match(/wa\.me\/(\d+)/)?.[1] ?? "5541995385660";
    const text = [
      `Olá, BelaCiclo! Tenho interesse nesta peça: ${productName} (${productPrice}).`,
      photoUrl ? `Foto do produto: ${photoUrl}` : "",
      `Veja o produto: ${productUrl}`,
    ].filter(Boolean).join("\n\n");
    const whatsappUrl = new URL(`https://wa.me/${phone}`);
    whatsappUrl.searchParams.set("text", text);
    window.location.assign(whatsappUrl.toString());
  }

  return <div className="product-contact-actions">
    <button className="whatsapp-product whatsapp-product-share" type="button" onClick={shareProduct} aria-label={`Perguntar sobre ${productName} pelo WhatsApp da BelaCiclo`}>
      <WhatsAppBrandMark/>Perguntar pelo WhatsApp
    </button>
    <a className="whatsapp-product whatsapp-product-email" href={`mailto:${storeConfig.email}?subject=${encodeURIComponent(`Dúvida sobre ${productName}`)}`}>
      <Icon name="mail"/> Perguntar sobre esta peça
    </a>
  </div>;
}
