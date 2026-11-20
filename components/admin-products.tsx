"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/config";

type ProductDepartment = "FEMININA" | "INFANTIL";
type VariantRow = { id: string; size: string | null; color: string | null; stock: number; reserved: number; active: boolean; movements: { delta: number; reason: string; createdAt: string }[] };
type ProductRow = { id: string; slug: string; name: string; description: string; department: ProductDepartment; category: string; price: number; promotionalPrice: number | null; active: boolean; demo: boolean; weightGrams: number | null; lengthCm: number | null; widthCm: number | null; heightCm: number | null; variants: VariantRow[]; images: { id: string; url: string; alt: string; position: number }[] };

export function AdminProducts() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [message, setMessage] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [busy, setBusy] = useState(false);
  const [productFeedback, setProductFeedback] = useState<Record<string, string>>({});
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [productEditFeedback, setProductEditFeedback] = useState<Record<string, string>>({});
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  async function refresh() {
    setLoadingProducts(true);
    let lastError = "Não foi possível consultar produtos e estoque. Tente novamente.";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch("/api/admin/products", { cache: "no-store" });
        const data = await response.json();
        if (response.ok && Array.isArray(data.products)) {
          setProducts(data.products);
          setCatalogError("");
          setLoadingProducts(false);
          return;
        }
        lastError = data.message ?? lastError;
      } catch {
        lastError = "A conexão com o catálogo falhou. Os dados existentes não foram alterados.";
      }
      if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 300 * (attempt + 1)));
    }
    setCatalogError(lastError);
    setLoadingProducts(false);
  }
  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true); setMessage("");
    const form = new FormData(formElement);
    const sizes = String(form.get("sizes")).split(",").map((value) => value.trim()).filter(Boolean);
    const stock = Number(form.get("stock"));
    const imageUrls = String(form.get("imageUrl")).split(",").map((url) => url.trim()).filter(Boolean);
    const files = form.getAll("imageFiles").filter((value): value is File => value instanceof File && value.size > 0);
    const name = String(form.get("name"));
    const color = String(form.get("color")).trim();
    const numberOrNull = (key: string) => String(form.get(key)).trim() ? Number(form.get(key)) : null;
    const payload = {
      slug: form.get("slug"), name, department: form.get("department"), description: form.get("description"), category: form.get("category"),
      priceCents: Math.round(Number(form.get("price")) * 100),
      promotionalPriceCents: String(form.get("promotionalPrice")).trim() ? Math.round(Number(form.get("promotionalPrice")) * 100) : null,
      weightGrams: numberOrNull("weightGrams"), lengthCm: numberOrNull("lengthCm"), widthCm: numberOrNull("widthCm"), heightCm: numberOrNull("heightCm"),
      images: imageUrls.map((url, position) => ({ url, alt: `${name} — imagem ${position + 1}`, position })),
      variants: sizes.map((size) => ({ size, color: color || undefined, stock })), relatedIds: [] as string[]
    };
    try {
      if (imageUrls.length + files.length > 12) { setMessage("Envie no máximo 12 fotos por produto."); return; }
      for (const file of files) {
        const uploadForm = new FormData(); uploadForm.append("file", file);
        try {
          const uploadResponse = await fetch("/api/admin/media", { method: "POST", body: uploadForm });
          const uploadData = await uploadResponse.json();
          if (!uploadResponse.ok) {
            setMessage(uploadData.message ?? "Não foi possível salvar as fotos selecionadas. O produto não foi cadastrado.");
            return;
          }
          imageUrls.push(uploadData.url as string);
        } catch {
          setMessage("Não foi possível salvar as fotos selecionadas. Confira a conexão e tente novamente; o produto não foi cadastrado.");
          return;
        }
      }
      payload.images = imageUrls.map((url, position) => ({ url, alt: `${name} — imagem ${position + 1}`, position }));
      const response = await fetch("/api/admin/products", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (response.ok) {
        formElement.reset();
        await refresh();
        setMessage(data.message ?? "Produto cadastrado.");
      } else {
        setMessage(data.message ?? "Não foi possível salvar o produto.");
      }
    } catch { setMessage("Não foi possível salvar o produto."); }
    finally { setBusy(false); }
  }

  async function request(url: string, method: string, body?: unknown) {
    try {
      const response = await fetch(url, { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
      const data = response.status === 204 ? {} : await response.json();
      setMessage(data.message ?? (response.ok ? "Alteração salva." : "Não foi possível concluir a alteração."));
      if (response.ok) await refresh();
    } catch { setMessage("Não foi possível concluir a alteração."); }
  }

  async function toggleProduct(product: ProductRow) {
    const activating = !product.active;
    setPendingProductId(product.id);
    setProductFeedback((current) => ({ ...current, [product.id]: "" }));
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: activating, ...(activating ? { demo: false } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) {
        setProductFeedback((current) => ({ ...current, [product.id]: data.message ?? "Não foi possível alterar o status do produto." }));
        return;
      }
      setProductFeedback((current) => ({ ...current, [product.id]: activating ? "Produto ativado com sucesso." : "Produto desativado." }));
      await refresh();
    } catch {
      setProductFeedback((current) => ({ ...current, [product.id]: "Não foi possível salvar o status. Confira a conexão e tente novamente." }));
    } finally {
      setPendingProductId(null);
    }
  }

  async function edit(event: FormEvent<HTMLFormElement>, product: ProductRow) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setEditingProductId(product.id);
    setProductEditFeedback((current) => ({ ...current, [product.id]: "" }));
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({
        name: String(form.get("name")), description: String(form.get("description")), department: form.get("department"), category: String(form.get("category")),
        priceCents: Math.round(Number(form.get("price")) * 100), promotionalPriceCents: String(form.get("promotionalPrice")).trim() ? Math.round(Number(form.get("promotionalPrice")) * 100) : null,
        weightGrams: String(form.get("weightGrams")).trim() ? Number(form.get("weightGrams")) : null,
        lengthCm: String(form.get("lengthCm")).trim() ? Number(form.get("lengthCm")) : null,
        widthCm: String(form.get("widthCm")).trim() ? Number(form.get("widthCm")) : null,
        heightCm: String(form.get("heightCm")).trim() ? Number(form.get("heightCm")) : null,
      }) });
      const data = await response.json();
      if (!response.ok) {
        setProductEditFeedback((current) => ({ ...current, [product.id]: data.message ?? "Não foi possível salvar a edição." }));
        return;
      }
      await refresh();
      setProductEditFeedback((current) => ({ ...current, [product.id]: "Alterações do produto salvas." }));
    } catch {
      setProductEditFeedback((current) => ({ ...current, [product.id]: "Não foi possível salvar a edição. Confira a conexão e tente novamente." }));
    } finally {
      setEditingProductId(null);
    }
  }

  async function remove(product: ProductRow) {
    if (!window.confirm(`Excluir ${product.name}? Pedidos que já usam esta peça podem impedir a exclusão.`)) return;
    await request(`/api/admin/products/${product.id}`, "DELETE");
  }

  async function addImages(event: FormEvent<HTMLFormElement>, product: ProductRow) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const urls = String(form.get("url")).split(",").map((url) => url.trim()).filter(Boolean);
    const files = form.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
    if (urls.length + files.length < 1 || urls.length + files.length > 12) { setMessage("Adicione de uma a doze imagens por vez."); return; }
    setBusy(true); setMessage("");
    try {
      for (const file of files) {
        const uploadForm = new FormData(); uploadForm.append("file", file);
        const upload = await fetch("/api/admin/media", { method: "POST", body: uploadForm }); const uploaded = await upload.json();
        if (!upload.ok) { setMessage(uploaded.message ?? "Não foi possível enviar uma foto."); return; }
        urls.push(uploaded.url as string);
      }
      for (const [index, url] of urls.entries()) {
        const response = await fetch(`/api/admin/products/${product.id}/images`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, alt: String(form.get("alt")).trim() || `${product.name} — imagem ${index + 1}` }) });
        const data = await response.json();
        if (!response.ok) { setMessage(data.message ?? "Não foi possível adicionar uma imagem."); return; }
      }
      setMessage("Imagens adicionadas."); formElement.reset(); await refresh();
    } catch { setMessage("Não foi possível adicionar as imagens."); }
    finally { setBusy(false); }
  }

  return <div className="admin-content">
    <form className="admin-form" onSubmit={create}>
      <h2>Novo produto</h2>
      <div className="admin-form-grid">
        <label>Nome<input name="name" required maxLength={140}/></label>
        <label>Identificador URL<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="nome-da-peca"/></label>
        <label>Departamento<select name="department" defaultValue="FEMININA"><option value="FEMININA">Moda feminina</option><option value="INFANTIL">Moda infantil</option></select></label>
        <label>Categoria<input name="category" required maxLength={80} placeholder="Alfaiataria"/></label>
        <label>Preço oficial (R$)<input name="price" type="number" step="0.01" min="0.01" required/></label>
        <label>Preço promocional opcional (R$)<input name="promotionalPrice" type="number" step="0.01" min="0.01"/></label>
        <label>Descrição<textarea name="description" required minLength={5} maxLength={5000} rows={3}/></label>
        <label>Fotos oficiais, URLs HTTPS separadas por vírgula<input name="imageUrl" placeholder="https://..."/></label>
        <label>Ou envie fotos JPEG, PNG, WebP ou AVIF (até 8 MB cada)<input name="imageFiles" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple/></label>
        <label>Tamanhos, separados por vírgula<input name="sizes" placeholder="P, M, G" required/></label>
        <label>Cor / acabamento<input name="color" placeholder="Informe o dado oficial"/></label>
        <label>Estoque inicial por tamanho<input name="stock" type="number" min="0" defaultValue="0" required/></label>
        <label>Peso da embalagem (g)<input name="weightGrams" type="number" min="1"/></label>
        <label>Comprimento (cm)<input name="lengthCm" type="number" min="1"/></label>
        <label>Largura (cm)<input name="widthCm" type="number" min="1"/></label>
        <label>Altura (cm)<input name="heightCm" type="number" min="1"/></label>
      </div>
      <p className="form-feedback">Para cotar PAC e SEDEX, informe o peso e as dimensões reais da embalagem pronta para envio. Não use estimativas; sem esses dados, o frete ficará a combinar.</p>
      <button className="button button-dark" disabled={busy}>{busy ? "Salvando…" : "Cadastrar produto"} →</button>
      <p className="form-feedback">O produto fica inativo até a ativação manual. O estoque inicial e os ajustes ficam registrados no histórico.</p>
    </form>
    <p className="form-feedback" aria-live="polite">{message}</p>
    <h2>Catálogo e estoque</h2>
    {catalogError && <p className="admin-data-warning" role="alert">{catalogError} {products.length > 0 ? "A lista abaixo mostra os últimos dados carregados." : "Nenhum produto foi removido. Recarregue a lista para consultar o banco novamente."} <button type="button" className="text-link" onClick={() => void refresh()}>Tentar novamente</button></p>}
    <div className="admin-table">{products.map((product) => <article className="admin-product" key={product.id}>
      <div className="admin-row">
        <div><b>{product.name}</b><span>{product.slug} · {product.department === "INFANTIL" ? "Infantil" : "Feminina"} · {product.category} · {product.variants.reduce((sum, variant) => sum + Math.max(0, variant.stock - variant.reserved), 0)} un. disponíveis</span></div>
        <b>{formatCurrency(product.price)}</b>
        <span className={`admin-state ${product.active ? "active" : ""}`}>{product.active ? "Ativo" : "Inativo"}{product.demo ? " · Demonstração" : ""}</span>
        <button type="button" disabled={pendingProductId === product.id} onClick={() => void toggleProduct(product)}>{pendingProductId === product.id ? (product.active ? "Desativando…" : "Ativando…") : product.active ? "Desativar" : "Ativar"}</button>
        <button className="remove-link" onClick={() => void remove(product)}>Excluir</button>
      </div>
      {productFeedback[product.id] && <p className="admin-product-feedback" role="status" aria-live="polite">{productFeedback[product.id]}</p>}
      <details className="admin-product-details"><summary>Editar peça, envio e tamanhos</summary>
        <form className="admin-form admin-edit-form" onSubmit={(event) => void edit(event, product)}>
          <div className="admin-form-grid">
            <label>Nome<input name="name" defaultValue={product.name} required maxLength={140}/></label>
            <label>Departamento<select name="department" defaultValue={product.department}><option value="FEMININA">Moda feminina</option><option value="INFANTIL">Moda infantil</option></select></label>
            <label>Categoria<input name="category" defaultValue={product.category} required maxLength={80}/></label>
            <label>Descrição<textarea name="description" defaultValue={product.description} required minLength={5} maxLength={5000} rows={3}/></label>
            <label>Preço oficial (R$)<input name="price" type="number" step="0.01" min="0.01" defaultValue={(product.price / 100).toFixed(2)} required/></label>
            <label>Preço promocional opcional (R$)<input name="promotionalPrice" type="number" step="0.01" min="0.01" defaultValue={product.promotionalPrice ? (product.promotionalPrice / 100).toFixed(2) : ""}/></label>
            <label>Peso da embalagem (g)<input name="weightGrams" type="number" min="1" defaultValue={product.weightGrams ?? ""}/></label>
            <label>Comprimento (cm)<input name="lengthCm" type="number" min="1" defaultValue={product.lengthCm ?? ""}/></label>
            <label>Largura (cm)<input name="widthCm" type="number" min="1" defaultValue={product.widthCm ?? ""}/></label>
            <label>Altura (cm)<input name="heightCm" type="number" min="1" defaultValue={product.heightCm ?? ""}/></label>
          </div>
          <p className="form-feedback">Use o peso e as dimensões reais da embalagem pronta para envio. Sem os quatro valores, este produto não será cotado pelos Correios.</p>
          <button type="submit" className="button button-dark" disabled={editingProductId === product.id}>{editingProductId === product.id ? "Salvando…" : "Salvar edição"}</button>
          <p className="form-feedback" role="status" aria-live="polite">{productEditFeedback[product.id] ?? ""}</p>
        </form>
        <div className="admin-variants">{product.variants.map((variant) => <div className="admin-variant" key={variant.id}>
          <div><b>{variant.size ?? "Tamanho único"}{variant.color ? ` · ${variant.color}` : ""}</b><span>{variant.stock} em estoque · {variant.reserved} reservada(s) · {Math.max(0, variant.stock - variant.reserved)} disponível(is)</span>{variant.movements.map((movement, index) => <small className="stock-movement" key={`${variant.id}-${movement.createdAt}-${index}`}>{movement.delta > 0 ? "+" : ""}{movement.delta} · {movement.reason} · {new Date(movement.createdAt).toLocaleDateString("pt-BR")}</small>)}</div>
          <form onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const delta = Number(new FormData(form).get("delta")); void request(`/api/admin/products/${product.id}/stock`, "POST", { variantId: variant.id, delta }).then(() => form.reset()); }}><label className="sr-only" htmlFor={`stock-${variant.id}`}>Ajuste de unidades para {variant.size}</label><input id={`stock-${variant.id}`} name="delta" type="number" step="1" min="-10000" max="10000" placeholder="± unidades" required/><button>Registrar ajuste</button></form>
          <button onClick={() => request(`/api/admin/products/${product.id}/variants/${variant.id}`, "PATCH", { active: !variant.active })}>{variant.active ? "Desativar tamanho" : "Reativar tamanho"}</button>
        </div>)}
          <form className="admin-add-variant" onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); await request(`/api/admin/products/${product.id}/variants`, "POST", { size: data.get("size"), color: data.get("color") }); form.reset(); }}>
            <label>Novo tamanho<input name="size" required maxLength={30} placeholder="P, M, 4 anos…"/></label><label>Cor, se aplicável<input name="color" maxLength={60}/></label><button>Adicionar tamanho</button>
          </form>
        </div>
        <section className="admin-images"><h3>Fotos oficiais ({product.images.length})</h3>{product.images.map((image) => <div className="admin-image-row" key={image.id}><div><a href={image.url} target="_blank" rel="noreferrer">Abrir foto oficial</a><span>{image.alt}</span></div><button type="button" onClick={() => request(`/api/admin/products/${product.id}/images/${image.id}`, "DELETE")}>Remover</button></div>)}
          <form className="admin-add-image" onSubmit={(event) => void addImages(event, product)}><label>URLs oficiais HTTPS<input name="url" placeholder="https://... (separe por vírgula)"/></label><label>Ou envie fotos JPEG, PNG, WebP ou AVIF<input name="files" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple/></label><label>Texto alternativo<input name="alt" maxLength={250} placeholder="Ex.: blazer em fundo claro"/></label><button className="button button-outline" disabled={busy}>Adicionar fotos</button></form>
        </section></details>
    </article>)}{loadingProducts && products.length === 0 && <p className="empty-note" role="status">Carregando produtos e estoque…</p>}{!loadingProducts && !catalogError && products.length === 0 && <p className="empty-note">Nenhum produto cadastrado no banco de dados.</p>}</div>
  </div>;
}
