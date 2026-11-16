"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const items = [
  { category: "Compras", question: "Como faço um pedido?", answer: "Escolha as peças disponíveis, selecione as variações e adicione à sacola. O pagamento é por PIX manual; a compra só pode ser finalizada quando houver um valor real de entrega calculado pelos Correios ou configurado pela BelaCiclo." },
  { category: "Pagamentos", question: "Quais formas de pagamento são aceitas?", answer: "A loja trabalha com PIX. Quando o checkout estiver configurado, você poderá pagar pelo QR Code ou código copia e cola; a confirmação é feita manualmente após a conferência bancária." },
  { category: "Entrega", question: "Como calculo o prazo e o valor da entrega?", answer: "Quando estiver ativa, a regra regional usa R$ 10,00 para Curitiba e os 29 municípios da Região Metropolitana, R$ 20,00 para o interior do Paraná e R$ 30,00 para outros estados. O checkout confirma a tarifa pelo CEP antes de finalizar. Frete fixo e grátis dependem de ativação no painel. PAC e SEDEX só aparecem quando os Correios habilitam a cotação para o CEP e as dimensões reais dos produtos. Prazos da loja são estimativas configuráveis; nos Correios, o prazo vem da cotação oficial." },
  { category: "Produtos", question: "Quando o catálogo estará disponível?", answer: "O catálogo será publicado depois que a BelaCiclo cadastrar as peças oficiais, fotografias, preços e estoque." },
  { category: "Trocas e devoluções", question: "Como funciona o direito de arrependimento?", answer: "As compras online estão sujeitas aos direitos previstos na legislação brasileira, incluindo o prazo legal de arrependimento quando aplicável. Os procedimentos de atendimento serão publicados após a confirmação dos dados empresariais." }
];

export function FaqList() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => items.filter((item) => `${item.question} ${item.answer} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <>
    <label className="faq-search"><span className="sr-only">Buscar pergunta</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar uma resposta"/><span>⌕</span></label>
    {filtered.length ? <div className="faq-list">{filtered.map((item) => <details key={item.question} className="faq-item"><summary><span><small>{item.category}</small>{item.question}</span><b>+</b></summary><p>{item.answer}</p></details>)}</div> : <p className="empty-note">Nenhuma resposta encontrada. <Link href="/contato">Fale com a gente</Link>.</p>}
  </>;
}
