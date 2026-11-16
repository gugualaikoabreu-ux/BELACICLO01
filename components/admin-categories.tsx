"use client";

import { FormEvent, useEffect, useState } from "react";

type CategoryRow = { id: string; name: string; department: "FEMININA" | "INFANTIL"; description: string | null; active: boolean; _count: { products: number } };

export function AdminCategories() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [categoryEditFeedback, setCategoryEditFeedback] = useState<Record<string, string>>({});
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  async function refresh() {
    try {
      const response = await fetch("/api/admin/categories", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setCategories(data.categories);
      else setMessage(data.message ?? "Não foi possível carregar as categorias.");
    } catch { setMessage("Não foi possível carregar as categorias."); }
  }

  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true); setMessage("");
    const data = new FormData(form);
    try {
      const response = await fetch("/api/admin/categories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name"), department: data.get("department"), description: data.get("description") }) });
      const result = await response.json();
      setMessage(result.message ?? (response.ok ? "Categoria salva." : "Não foi possível salvar a categoria."));
      if (response.ok) { form.reset(); await refresh(); }
    } catch { setMessage("Não foi possível salvar a categoria."); }
    finally { setBusy(false); }
  }

  async function update(event: FormEvent<HTMLFormElement>, category: CategoryRow) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    setEditingCategoryId(category.id);
    setCategoryEditFeedback((current) => ({ ...current, [category.id]: "" }));
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name"), department: data.get("department"), description: data.get("description") }) });
      const result = await response.json();
      if (!response.ok) {
        const feedback = result.message ?? "Não foi possível atualizar a categoria.";
        setMessage(feedback);
        setCategoryEditFeedback((current) => ({ ...current, [category.id]: feedback }));
        return;
      }
      await refresh();
      setMessage("Categoria atualizada.");
      setCategoryEditFeedback((current) => ({ ...current, [category.id]: "Alterações da categoria salvas." }));
    } catch {
      const feedback = "Não foi possível atualizar a categoria. Confira a conexão e tente novamente.";
      setMessage(feedback);
      setCategoryEditFeedback((current) => ({ ...current, [category.id]: feedback }));
    } finally { setBusy(false); setEditingCategoryId(null); }
  }

  async function toggle(category: CategoryRow) {
    if (category.active && category._count.products > 0 && !window.confirm(`Desativar ${category.name}? Os produtos ativos desta categoria também serão desativados.`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !category.active }) });
      const result = await response.json();
      setMessage(result.message ?? (response.ok ? "Categoria atualizada." : "Não foi possível atualizar a categoria."));
      if (response.ok) await refresh();
    } catch { setMessage("Não foi possível atualizar a categoria."); }
    finally { setBusy(false); }
  }

  return <div className="admin-content">
    <form className="admin-form" onSubmit={(event) => void create(event)}>
      <h2>Nova categoria</h2>
      <div className="admin-form-grid">
        <label>Nome<input name="name" required minLength={2} maxLength={80} placeholder="Alfaiataria"/></label>
        <label>Departamento<select name="department" defaultValue="FEMININA"><option value="FEMININA">Moda feminina</option><option value="INFANTIL">Moda infantil</option></select></label>
        <label>Descrição opcional<input name="description" maxLength={500}/></label>
      </div>
      <button className="button button-dark" disabled={busy}>{busy ? "Salvando…" : "Salvar categoria"} →</button>
    </form>
    <p className="form-feedback" aria-live="polite">{message}</p>
    <h2>Categorias cadastradas</h2>
    <div className="admin-table">{categories.map((category) => <article className="admin-product" key={category.id}>
      <div className="admin-row"><div><b>{category.name}</b><span>{category.department === "INFANTIL" ? "Moda infantil" : "Moda feminina"} · {category._count.products} produto(s)</span></div><span className={`admin-state ${category.active ? "active" : ""}`}>{category.active ? "Ativa" : "Inativa"}</span><button disabled={busy} onClick={() => void toggle(category)}>{category.active ? "Desativar" : "Ativar"}</button></div>
      <form className="admin-form admin-edit-form" onSubmit={(event) => void update(event, category)}>
        <div className="admin-form-grid"><label>Nome<input name="name" defaultValue={category.name} required minLength={2} maxLength={80}/></label><label>Departamento<select name="department" defaultValue={category.department}><option value="FEMININA">Moda feminina</option><option value="INFANTIL">Moda infantil</option></select></label><label>Descrição<input name="description" defaultValue={category.description ?? ""} maxLength={500}/></label></div>
        <button type="submit" className="button button-outline" disabled={busy}>{editingCategoryId === category.id ? "Salvando…" : "Salvar alterações"}</button>
        <p className="form-feedback" role="status" aria-live="polite">{categoryEditFeedback[category.id] ?? ""}</p>
      </form>
    </article>)}{categories.length === 0 && <p className="empty-note">Nenhuma categoria cadastrada.</p>}</div>
  </div>;
}
