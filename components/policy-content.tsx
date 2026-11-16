import Link from "next/link";
type Section = { title: string; body: string };
export function PolicyContent({ title, intro, sections }: { title: string; intro: string; sections: Section[] }) {
  return <section className="page-section policy-page"><div className="page-heading"><span className="eyebrow">INFORMAÇÕES BELACICLO</span><h1>{title}</h1><p>{intro}</p></div><div className="policy-draft"><b>Documento preliminar</b><p>Esta página é uma base de conteúdo para revisão. Dados empresariais, canais oficiais e procedimentos comerciais ainda precisam ser confirmados antes da abertura da loja.</p></div><div className="policy-body">{sections.map((section) => <article key={section.title}><h2>{section.title}</h2><p>{section.body}</p></article>)}</div><div className="policy-contact">Dúvidas? <Link href="/contato">Fale com a BelaCiclo →</Link></div></section>;
}
