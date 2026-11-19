import { Icon } from "@/components/icons";
import { storeConfig } from "@/lib/config";

function InstagramBrandMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2" y="2" width="20" height="20" rx="6" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4.25" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="17.6" cy="6.6" r="1.25" fill="currentColor"/></svg>;
}

function WhatsAppBrandMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.52 3.48A11.82 11.82 0 0 0 12.1 0C5.55 0 .22 5.33.22 11.88c0 2.09.55 4.14 1.6 5.95L.13 24l6.34-1.66a11.9 11.9 0 0 0 5.63 1.43h.01c6.55 0 11.88-5.33 11.89-11.88a11.82 11.82 0 0 0-3.48-8.41ZM12.1 21.75h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.22-3.76.99 1-3.66-.24-.38a9.85 9.85 0 0 1-1.52-5.22c0-5.46 4.45-9.9 9.92-9.9a9.84 9.84 0 0 1 7.02 2.91 9.84 9.84 0 0 1 2.9 7.01c0 5.46-4.45 9.9-9.92 9.9Zm5.44-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.49-.9-.79-1.5-1.77-1.68-2.07-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.63-.93-2.23-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.53.08-.8.38-.28.3-1.05 1.02-1.05 2.49s1.08 2.89 1.23 3.09c.15.2 2.11 3.22 5.1 4.52.71.31 1.27.5 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.77-.73 2.02-1.43.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z"/></svg>;
}

export function SupportEmailLink() {
  return <div className="contact-float">
    <div className="contact-socials" aria-label="Redes sociais da BelaCiclo">
      <a className="contact-social-link contact-social-link--instagram" href={storeConfig.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram da BelaCiclo — @belaciclo" title="Instagram @belaciclo"><InstagramBrandMark/></a>
      <a className="contact-social-link contact-social-link--whatsapp" href={storeConfig.whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label="Conversar com a BelaCiclo pelo WhatsApp" title="WhatsApp BelaCiclo"><WhatsAppBrandMark/></a>
    </div>
    <a className="whatsapp-float" href={`mailto:${storeConfig.email}`} aria-label="Enviar e-mail para a Bela Ciclo"><Icon name="mail"/><span>Fale com a gente</span></a>
  </div>;
}
