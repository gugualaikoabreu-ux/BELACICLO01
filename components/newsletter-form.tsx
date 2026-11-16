"use client";

import { FormEvent, useState } from "react";
import { Icon } from "@/components/icons";

export function NewsletterForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email"), consent: form.get("consent") === "on" }) });
      const data = await response.json();
      setMessage(data.message ?? "Não foi possível concluir agora.");
      if (response.ok) event.currentTarget.reset();
    } catch {
      setMessage("Não foi possível concluir agora. Tente novamente em instantes.");
    } finally {
      setBusy(false);
    }
  }
  return <form className="newsletter-form" onSubmit={submit}>
    <label htmlFor="club-email">Seu melhor e-mail</label><div className="newsletter-input"><input id="club-email" name="email" type="email" autoComplete="email" placeholder="voce@email.com" required/><button disabled={busy} aria-label="Inscrever-se no Clube BelaCiclo"><Icon name="arrow"/></button></div>
    <label className="consent"><input type="checkbox" name="consent" required/><span>Concordo em receber comunicações da BelaCiclo. Posso cancelar a qualquer momento.</span></label>
    <p className="form-feedback" aria-live="polite">{message}</p>
  </form>;
}
