"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/app/minha-conta/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isStoreAdminEmail } from "@/lib/admin-identity";
import { Icon } from "@/components/icons";

function displayName(user: User) {
  const name = user.user_metadata?.name;
  return typeof name === "string" && name.trim() ? name : user.email ?? "cliente";
}

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [showAdminLink, setShowAdminLink] = useState(false);
  const [isPending, setIsPending] = useState(isSupabaseConfigured);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createSupabaseBrowserClient();
    const refreshAdminAccess = async (email: string | null | undefined) => {
      const isOwner = isStoreAdminEmail(email);
      try {
        const response = await fetch("/api/admin/status", { cache: "no-store" });
        const data = await response.json();
        setShowAdminLink(isOwner || (response.ok && data.isAdmin === true));
      } catch {
        setShowAdminLink(isOwner);
      }
    };
    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setIsPending(false);
      if (data.user) void refreshAdminAccess(data.user.email);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) void refreshAdminAccess(currentUser.email);
      else setShowAdminLink(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    if (!isSupabaseConfigured) { setMessage("O cadastro ainda não está conectado ao Supabase."); setBusy(false); return; }
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    const name = String(form.get("name") ?? "").trim();
    const supabase = createSupabaseBrowserClient();
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: `${window.location.origin}/auth/callback` } });

    if (result.error) setMessage("Não foi possível concluir. Verifique os dados e tente novamente.");
    else if (mode === "login") window.location.reload();
    else setMessage("Cadastro iniciado. Confirme seu e-mail para ativar a conta.");
    setBusy(false);
  }

  async function signOut() {
    if (!isSupabaseConfigured) return;
    await createSupabaseBrowserClient().auth.signOut();
  }

  if (isPending) return <section className="page-section"><p>Carregando conta…</p></section>;
  if (user) return <section className="page-section account-page"><div className="page-heading"><span className="eyebrow">ÁREA DO CLIENTE</span><h1>Olá, <em>{displayName(user)}.</em></h1><p>Que bom ter você por aqui.</p></div><div className="account-links">{showAdminLink && <Link href="/admin"><span>00</span><div><b>Painel da loja</b><small>Produtos, pedidos e configurações</small></div><Icon name="arrow"/></Link>}<Link href="/minha-conta/pedidos"><span>01</span><div><b>Meus pedidos</b><small>Histórico, status e rastreamento</small></div><Icon name="arrow"/></Link><Link href="/minha-conta/perfil"><span>02</span><div><b>Meus dados</b><small>Atualizar informações pessoais</small></div><Icon name="arrow"/></Link><Link href="/minha-conta/enderecos"><span>03</span><div><b>Meus endereços</b><small>Gerenciar dados de entrega</small></div><Icon name="arrow"/></Link><Link href="/favoritos"><span>04</span><div><b>Meus favoritos</b><small>Suas peças salvas</small></div><Icon name="arrow"/></Link><button onClick={signOut}><span>05</span><div><b>Sair da conta</b><small>Encerrar sessão</small></div><Icon name="arrow"/></button></div></section>;
  return <section className="page-section auth-page"><div className="auth-panel"><span className="eyebrow">ÁREA DO CLIENTE</span><h1>{mode === "login" ? <>Que bom <em>ver você.</em></> : <>Um espaço <em>seu.</em></>}</h1><p>{mode === "login" ? "Entre para acompanhar seus pedidos e favoritos." : "Crie sua conta BelaCiclo."}</p><form onSubmit={submit} className="auth-form">{mode === "register" && <label>Nome completo<input name="name" autoComplete="name" required/></label>}<label>E-mail<input name="email" type="email" autoComplete="email" required/></label><label>Senha<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required/></label>{mode === "login" && <Link href="/minha-conta/recuperar" className="text-link small-link">Esqueci minha senha</Link>}<button className="button button-dark full-button" disabled={busy}>{busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}<Icon name="arrow"/></button><p className="form-feedback" aria-live="polite">{message}</p></form><button className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); }}>{mode === "login" ? "Ainda não tem conta? Cadastre-se" : "Já tem conta? Entrar"}</button><p className="auth-note">{isSupabaseConfigured ? "Sua conta é protegida pela autenticação do Supabase." : "O cadastro ficará disponível depois de configurar as chaves do Supabase."}</p></div></section>;
}
