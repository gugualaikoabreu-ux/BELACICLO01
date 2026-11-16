"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/app/minha-conta/auth-client";
import { Icon } from "@/components/icons";

function ResetPasswordForm() {
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { void createSupabaseBrowserClient().auth.getUser().then(({ data }) => setHasRecoverySession(Boolean(data.user))); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); const password = String(new FormData(event.currentTarget).get("password")); try { const { error } = await createSupabaseBrowserClient().auth.updateUser({ password }); setMessage(error ? "O link não é válido ou expirou. Solicite uma nova recuperação." : "Senha atualizada. Você já pode entrar na sua conta."); } catch { setMessage("Não foi possível redefinir a senha. Solicite um novo link."); } finally { setBusy(false); } }
  return <section className="page-section auth-page"><div className="auth-panel"><span className="eyebrow">RECUPERAÇÃO DE ACESSO</span><h1>Nova <em>senha.</em></h1><p>Escolha uma senha com pelo menos 8 caracteres.</p>{hasRecoverySession ? <form className="auth-form" onSubmit={submit}><label>Nova senha<input name="password" type="password" minLength={8} autoComplete="new-password" required/></label><button className="button button-dark full-button" disabled={busy}>{busy ? "Salvando…" : "Atualizar senha"}<Icon name="arrow"/></button><p className="form-feedback" aria-live="polite">{message}</p></form> : <p className="empty-note">Abra o link de recuperação enviado por e-mail. <Link href="/minha-conta/recuperar">Solicitar outro</Link>.</p>}<Link href="/minha-conta" className="text-link">Voltar para entrar <span>→</span></Link></div></section>;
}
export default function ResetPasswordPage() { return <Suspense fallback={<section className="page-section">Carregando…</section>}><ResetPasswordForm/></Suspense>; }
