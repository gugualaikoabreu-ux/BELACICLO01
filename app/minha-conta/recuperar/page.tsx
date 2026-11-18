"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/app/minha-conta/auth-client";
import { getAuthCallbackUrl } from "@/lib/supabase/auth-redirect";
import { Icon } from "@/components/icons";

export default function RecoverPage() {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const email = String(new FormData(event.currentTarget).get("email")).trim();
    try {
      const redirectTo = getAuthCallbackUrl("/minha-conta/redefinir");
      const { error } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(email, { redirectTo });
      setMessage(error ? "Não foi possível enviar agora. Verifique a configuração de e-mail." : "Se o endereço estiver cadastrado, você receberá instruções para redefinir sua senha.");
    } catch { setMessage("Recuperação indisponível. Verifique a configuração do Supabase."); } finally { setBusy(false); }
  }
  return <section className="page-section auth-page"><div className="auth-panel"><span className="eyebrow">RECUPERAÇÃO DE ACESSO</span><h1>Vamos encontrar <em>sua conta.</em></h1><p>Informe o e-mail usado no cadastro.</p><form className="auth-form" onSubmit={submit}><label>E-mail<input name="email" type="email" autoComplete="email" required/></label><button className="button button-dark full-button" disabled={busy}>{busy ? "Enviando…" : "Enviar instruções"}<Icon name="arrow"/></button><p className="form-feedback" aria-live="polite">{message}</p></form><Link href="/minha-conta" className="text-link">Voltar para entrar <span>→</span></Link></div></section>;
}
