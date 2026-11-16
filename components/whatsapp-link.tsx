import { Icon } from "@/components/icons";
import { storeConfig } from "@/lib/config";

export function SupportEmailLink() {
  return <a className="whatsapp-float" href={`mailto:${storeConfig.email}`} aria-label="Enviar e-mail para a Bela Ciclo"><Icon name="mail"/><span>Fale com a gente</span></a>;
}
