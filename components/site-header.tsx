"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { useStore } from "@/components/store-context";

export function SiteHeader() {
  const { cartCount, favorites } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  return <>
    <header className="site-header">
      <button className="icon-button mobile-menu" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "close" : "menu"}/></button>
      <Link className="wordmark" href="/" aria-label="BelaCiclo — página inicial"><span>Bela</span><i>Ciclo</i><small>FEMININA · INFANTIL</small></Link>
      <nav className={`main-nav ${menuOpen ? "is-open" : ""}`} aria-label="Navegação principal">
        <Link href="/colecoes" onClick={() => setMenuOpen(false)}>Coleções</Link>
        <Link href="/colecoes?departamento=FEMININA" onClick={() => setMenuOpen(false)}>Feminina</Link>
        <Link href="/colecoes?departamento=INFANTIL" onClick={() => setMenuOpen(false)}>Infantil</Link>
        <Link href="/lookbook" onClick={() => setMenuOpen(false)}>Inspire-se</Link>
        <Link href="/minha-conta/pedidos" onClick={() => setMenuOpen(false)}>Meus pedidos</Link>
        <Link className="mobile-nav-only" href="/minha-conta" onClick={() => setMenuOpen(false)}>Minha conta</Link>
        <Link className="mobile-nav-only" href="/favoritos" onClick={() => setMenuOpen(false)}>Favoritos{favorites.length ? ` (${favorites.length})` : ""}</Link>
      </nav>
      <div className="header-actions">
        <button className="icon-button" aria-label="Pesquisar" onClick={() => setSearchOpen((v) => !v)}><Icon name="search"/></button>
        <Link className="icon-button desktop-action" href="/minha-conta" aria-label="Minha conta"><Icon name="user"/></Link>
        <Link className="icon-button desktop-action with-count" href="/favoritos" aria-label={`Favoritos, ${favorites.length} itens`}><Icon name="heart"/>{favorites.length > 0 && <b>{favorites.length}</b>}</Link>
        <Link className="icon-button with-count" href="/carrinho" aria-label={`Sacola, ${cartCount} itens`}><Icon name="bag"/>{cartCount > 0 && <b>{cartCount}</b>}</Link>
      </div>
    </header>
    {searchOpen && <form className="search-strip" action="/buscar"><label htmlFor="site-search">O que você procura?</label><input id="site-search" name="q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Feminina, infantil, alfaiataria..." autoFocus/><button aria-label="Buscar"><Icon name="arrow"/></button></form>}
  </>;
}
