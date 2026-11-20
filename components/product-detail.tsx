"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { ProductArt } from "@/components/product-art";
import { ProductGrid } from "@/components/product-grid";
import { WhatsAppProductShare } from "@/components/whatsapp-product-share";
import { useStore } from "@/components/store-context";
import { formatCurrency } from "@/lib/config";
import { trackStoreEvent } from "@/lib/analytics-client";
import type { Product } from "@/lib/products";
import { FREE_SHIPPING_PRODUCT_SLUG } from "@/lib/shipping/options";

export function ProductDetail({ product, related }: { product: Product; related: Product[] }) {
  const [size, setSize] = useState(product.variants[0]?.size ?? product.sizes[0] ?? "");
  const colors = [...new Set(product.variants.map((variant) => variant.color ?? ""))];
  const [color, setColor] = useState(colors[0] ?? "");
  const [added, setAdded] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const { addToCart, toggleFavorite, isFavorite, rememberProduct } = useStore();
  const photos = product.images?.length ? product.images : product.imageUrl ? [{ url: product.imageUrl, alt: product.imageAlt || product.name }] : [];
  const photoCount = Math.max(photos.length, 1);
  const imageProduct = photos[imageIndex] ? { ...product, imageUrl: photos[imageIndex].url, imageAlt: photos[imageIndex].alt } : product;
  const sizesForColor = [...new Set(product.variants.filter((variant) => (variant.color ?? "") === color && variant.size).map((variant) => variant.size as string))];
  const selectedVariant = product.variants.find((variant) => (variant.color ?? "") === color && variant.size === size);
  const changeImage = useCallback((direction: number) => setImageIndex((current) => (current + direction + photoCount) % photoCount), [photoCount]);

  useEffect(() => {
    rememberProduct(product.id);
    if (!product.isDemo) trackStoreEvent("view_item", { currency: "BRL", value: product.price / 100, items: [{ item_id: product.id, item_name: product.name, item_category: product.category, price: product.price / 100 }] });
  }, [product.id, product.isDemo, product.price, product.name, product.category, rememberProduct]);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomed(false);
      if (zoomed && event.key === "ArrowRight") changeImage(1);
      if (zoomed && event.key === "ArrowLeft") changeImage(-1);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [zoomed, changeImage]);

  function addCurrent() {
    if (!selectedVariant?.available) return;
    addToCart(product.id, size, 1, selectedVariant.id, color);
    setAdded(true);
    if (!product.isDemo) trackStoreEvent("add_to_cart", { currency: "BRL", value: product.price / 100, items: [{ item_id: product.id, item_name: product.name, item_category: product.category, price: product.price / 100, quantity: 1 }] });
    window.setTimeout(() => setAdded(false), 2200);
  }

  return <>
    <div className="breadcrumbs"><Link href="/">Início</Link><span>/</span><Link href="/colecoes">Coleção</Link><span>/</span><span>{product.name}</span></div>
    <section className="product-detail">
      <div className="product-gallery">
        <div className="gallery-main" onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const end = event.changedTouches[0]?.clientX; if (touchStart.current !== null && end !== undefined && Math.abs(end - touchStart.current) > 40) changeImage(end < touchStart.current ? 1 : -1); touchStart.current = null; }}>
          <ProductArt product={imageProduct}/>
          <button className="zoom-trigger" aria-label="Ampliar imagem" onClick={() => setZoomed(true)}><span>Ampliar</span> ⌕</button>
          <button className={`favorite-button ${isFavorite(product.id) ? "is-favorite" : ""}`} onClick={() => toggleFavorite(product.id)} aria-label={isFavorite(product.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}><Icon name="heart"/></button>
          {photoCount > 1 && <><button className="gallery-arrow previous" onClick={() => changeImage(-1)} aria-label="Imagem anterior">‹</button><button className="gallery-arrow next" onClick={() => changeImage(1)} aria-label="Próxima imagem">›</button></>}
        </div>
        {photoCount > 1 && <div className="gallery-thumbs">{photos.map((photo, index) => <button key={`${product.id}-${photo.url}`} className={`gallery-thumb ${index === imageIndex ? "selected" : ""}`} onClick={() => setImageIndex(index)} aria-label={`Ver imagem ${index + 1}`}><ProductArt product={{ ...product, imageUrl: photo.url, imageAlt: photo.alt }}/></button>)}</div>}
      </div>
      <div className="product-detail-copy">
        <span className="eyebrow">{product.department === "INFANTIL" ? "MODA INFANTIL" : "MODA FEMININA"} · {product.category.toUpperCase()}</span>
        <h1>{product.name}</h1>
        <p className="detail-price">{formatCurrency(product.price)}</p>
        {product.regularPrice && product.regularPrice > product.price && <p className="detail-note"><s>{formatCurrency(product.regularPrice)}</s></p>}
        <p className="detail-note">{color || product.colorName} · {product.note}</p>
        <p className="detail-description">{product.note}</p>
        {colors.length > 1 && <><div className="variant-heading"><span>Cor</span><small>{color || "Única"}</small></div><div className="size-options">{colors.map((value) => <button key={value || "unica"} className={color === value ? "selected" : ""} onClick={() => { setColor(value); const firstSize = product.variants.find((variant) => (variant.color ?? "") === value)?.size; if (firstSize) setSize(firstSize); }} aria-pressed={color === value}>{value || "Única"}</button>)}</div></>}
        <div className="variant-heading"><span>Tamanho</span><small>{selectedVariant?.available ? "Disponível" : "Sem estoque disponível"}</small></div>
        <div className="size-options">{sizesForColor.map((value) => { const available = product.variants.find((variant) => (variant.color ?? "") === color && variant.size === value)?.available ?? false; return <button key={value} className={size === value ? "selected" : ""} onClick={() => setSize(value)} aria-pressed={size === value} disabled={!available}>{value}</button>; })}</div>
        <button className="button button-dark full-button" onClick={addCurrent} disabled={!selectedVariant?.available}>{added ? "Adicionado à sacola" : "Adicionar à sacola"}<Icon name="arrow"/></button>
        <div className="detail-accordions"><details><summary>Detalhes da peça <Icon name="chevron"/></summary><p>{product.note}. Composição, origem e cuidados serão exibidos quando cadastrados pela BelaCiclo.</p></details><details><summary>Entrega e devoluções <Icon name="chevron"/></summary><p>{product.slug === FREE_SHIPPING_PRODUCT_SLUG ? "Frete grátis para esta peça quando comprada sozinha. Se adicionar outros produtos à sacola, o checkout calculará o frete normalmente." : "Consulte o CEP no checkout para ver as opções disponíveis."} O prazo só aparece quando informado pelos Correios. As regras de devolução estão na página de trocas.</p></details></div>
        <WhatsAppProductShare productName={product.name} productPrice={formatCurrency(product.price)} productSlug={product.slug} imageUrl={photos[imageIndex]?.url ?? product.imageUrl}/>
      </div>
    </section>
    {related.length > 0 && <section className="related-section section-wrap"><div className="section-heading"><div><span className="eyebrow">IDEIAS PARA COMBINAR</span><h2>Complete o <em>seu look.</em></h2></div></div><ProductGrid items={related}/></section>}
    {zoomed && <div className="zoom-lightbox" role="dialog" aria-modal="true" aria-label={`Imagem ampliada de ${product.name}`} onClick={(event) => { if (event.target === event.currentTarget) setZoomed(false); }}><button className="zoom-close" onClick={() => setZoomed(false)} aria-label="Fechar imagem">×</button>{photoCount > 1 && <button className="zoom-nav prev" onClick={() => changeImage(-1)} aria-label="Imagem anterior">‹</button>}<div><ProductArt product={imageProduct}/><span>{photos.length ? `${imageIndex + 1} / ${photoCount}` : "Fotografia oficial em preparação"}</span></div>{photoCount > 1 && <button className="zoom-nav next" onClick={() => changeImage(1)} aria-label="Próxima imagem">›</button>}</div>}
  </>;
}
