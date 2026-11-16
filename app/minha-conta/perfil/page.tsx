"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/app/minha-conta/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type AccountUser = { email?: string; user_metadata?: { name?: string } };

export default function ProfilePage() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  useEffect(() => { if (!isSupabaseConfigured) return; const supabase = createSupabaseBrowserClient(); void supabase.auth.getUser().then(({ data }) => setUser(data.user)); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const name = String(new FormData(event.currentTarget).get("name")).trim();
    try { const { error } = await createSupabaseBrowserClient().auth.updateUser({ data: { name } }); setMessage(error ? "Não foi possível atualizar seus dados." : "Dados atualizados."); if (!error) router.refresh(); }
    catch { setMessage("Não foi possível atualizar seus dados."); } finally { setBusy(false); }
  }
  if (!user) return <section className="page-section"><div className="page-heading"><h1>Acesse <em>sua conta.</em></h1></div><a href="/minha-conta">Entrar →</a></section>;
  return <section className="page-section auth-page"><div className="auth-panel"><span className="eyebrow">MEUS DADOS</span><h1>Seu perfil, <em>sempre seu.</em></h1><form className="auth-form" onSubmit={submit}><label>Nome completo<input name="name" defaultValue={user.user_metadata?.name ?? ""} required/></label><label>E-mail<input value={user.email ?? ""} readOnly/></label><button className="button button-dark" disabled={busy}>{busy ? "Salvando…" : "Salvar alterações"} →</button><p className="form-feedback">{message}</p></form><p className="auth-note">Para alterar o e-mail, confirme a identidade e o novo endereço por e-mail.</p></div></section>;
}
