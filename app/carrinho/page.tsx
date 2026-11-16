"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { ProductArt } from "@/components/product-art";
import { useStore } from "@/components/store-context";
import { formatCurrency } from "@/lib/config";

export default function CartPage() {
  const { cart, setQuantity, removeFromCart, catalog } = useStore();
  const lines = cart.map((line) => ({ ...line, product: catalog.find((product) => product.id === line.productId) })).filter((line) => line.product);
  const subtotal = lines.reduce((sum, line) => sum + line.product!.price * line.quantity, 0);
  return <section className="page-section cart-page">
    <div className="page-heading"><span className="eyebrow">SUA SELEÇÃO</span><h1>Sacola <em>BelaCiclo.</em></h1><p>Revise suas escolhas antes de continuar.</p></div>
    {lines.length ? <div className="cart-layout"><div className="cart-lines">{lines.map((line) => <article className="cart-line" key={line.variantId}>
      <Link href={`/produto/${line.product!.slug}`}><ProductArt product={line.product!}/></Link>
      <div className="cart-line-info"><Link href={`/produto/${line.product!.slug}`} className="product-name">{line.product!.name}</Link><p>{line.color || line.product!.colorName} · Tamanho {line.size}</p><div className="quantity-control"><button onClick={() => setQuantity(line.productId, line.size, line.variantId, line.quantity - 1)} aria-label="Diminuir quantidade"><Icon name="minus"/></button><span>{line.quantity}</span><button disabled={line.quantity >= 10} onClick={() => setQuantity(line.productId, line.size, line.variantId, line.quantity + 1)} aria-label="Aumentar quantidade"><Icon name="plus"/></button></div></div>
      <div className="cart-line-end"><strong>{formatCurrency(line.product!.price * line.quantity)}</strong><button className="remove-link" onClick={() => removeFromCart(line.productId, line.size, line.variantId)}>Remover</button></div>
    </article>)}</div>
      <aside className="cart-summary"><h2>Resumo</h2><div><span>Subtotal</span><b>{formatCurrency(subtotal)}</b></div><div><span>Entrega</span><span>Consulte no checkout</span></div><div className="summary-total"><span>Total parcial</span><b>{formatCurrency(subtotal)}</b></div><Link className="button button-dark full-button" href="/checkout">Continuar para checkout <Icon name="arrow"/></Link><p className="demo-checkout-note">A tarifa aparece no checkout quando disponível. Se não houver cotação ou regra configurada, o frete será combinado e pago separadamente antes do envio.</p><Link href="/colecoes" className="text-link">Continuar explorando</Link></aside>
    </div> : <div className="empty-state"><span className="empty-glyph">◌</span><h2>Sua sacola está vazia.</h2><p>As peças aparecerão aqui quando o catálogo oficial estiver publicado.</p><Link className="button button-outline" href="/colecoes">Explorar coleção <span>→</span></Link></div>}
  </section>;
}
