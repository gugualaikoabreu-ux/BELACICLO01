import { PolicyContent } from "@/components/policy-content";
import { createPageMetadata } from "@/lib/seo";
import { storeConfig } from "@/lib/config";

export const metadata = createPageMetadata({
  title: "Pagamento por PIX",
  description: "Veja como funciona o pagamento por PIX e a conferência manual de pedidos da BelaCiclo.",
  canonical: "/pagamento",
});

export default function PaymentPage() { return <PolicyContent title="Informações de pagamento" intro="A Bela Ciclo recebe pagamento exclusivamente por PIX manual. O pedido apresenta a chave oficial, o valor calculado e o número da compra." sections={[
  { title: "PIX manual", body: "A loja gera um QR Code e um código copia e cola com o valor exato do pedido. Antes de confirmar a transferência, confira o valor e os dados do recebedor apresentados pelo aplicativo do banco." },
  { title: "Comprovante e confirmação", body: `O cliente pode encaminhar o comprovante para ${storeConfig.email}. O envio do comprovante não confirma o pagamento: a equipe da Bela Ciclo só atualiza o pedido depois de conferir o crédito no banco.` },
  { title: "Prazo", body: "O estoque fica reservado durante o prazo mostrado no pedido. Se a reserva expirar, o pedido é cancelado e as unidades voltam ao catálogo; entre em contato pelo e-mail oficial se a transferência ocorrer depois desse prazo." },
  { title: "Outras formas", body: "Cartões, boleto, parcelamento e pagamentos automáticos não estão disponíveis." }
]}/>; }
