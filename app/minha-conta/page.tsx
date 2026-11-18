"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/app/minha-conta/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAuthCallbackUrl } from "@/lib/supabase/auth-redirect";
import { isStoreAdminEmail } from "@/lib/admin-identity";
import { Icon } from "@/components/icons";

function displayName(user: User) {
  const name = user.user_metadata?.name;
  return typeof name === "string" && name.trim() ? name : user.email ?? "cliente";
}

function authFailureMessage(error: unknown, mode: "login" | "register") {
  const details = error && typeof error === "object"
    ? `${"code" in error ? String(error.code) : ""} ${"message" in error ? String(error.message) : ""}`
    : String(error ?? "");
  const normalized = details.toLowerCase();

  if (/redirect.*(not allowed|allowlist)|url.*not allowed/.test(normalized)) {
    return "Não foi possível configurar o link de confirmação. Avise o suporte da BelaCiclo para verificarmos o cadastro.";
  }
  if (/already registered|already exists|user_already_exists/.test(normalized)) {
    return "Esse e-mail já pode ter uma conta. Tente entrar ou use “Esqueci minha senha”.";
  }
  if (/weak_password|password.*(short|weak)|password should/.test(normalized)) {
    return "Escolha uma senha mais forte, com pelo menos 8 caracteres.";
  }
  if (/over_email_send_rate_limit|rate limit|too many requests/.test(normalized)) {
    return "Muitas tentativas seguidas. Aguarde um pouco e tente novamente.";
  }
  if (/signup is disabled|signups not allowed|signup_disabled/.test(normalized)) {
    return "O cadastro está temporariamente indisponível. Fale com a BelaCiclo.";
  }
  if (/email not confirmed|email_not_confirmed/.test(normalized)) {
    return "Confirme seu e-mail pelo link enviado antes de entrar.";
  }
  if (/already confirmed|email_already_confirmed|user_already_confirmed/.test(normalized)) {
    return "Esse e-mail já está confirmado. Tente entrar com sua senha.";
  }
  if (/invalid login credentials|invalid_credentials/.test(normalized)) {
    return "E-mail ou senha incorretos. Confira os dados ou use “Esqueci minha senha”.";
  }
  if (/invalid email|email.*invalid/.test(normalized)) {
    return "Confira o formato do e-mail informado.";
  }
  if (/fetch|network|connection|timeout/.test(normalized)) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }

  return mode === "register"
    ? "Não foi possível criar a conta agora. Confira os dados e tente novamente. Se continuar, fale com a BelaCiclo."
    : "Não foi possível entrar agora. Confira seus dados e tente novamente.";
}

function isUnconfirmedEmailError(error: unknown) {
  const details = error && typeof error === "object"
    ? `${"code" in error ? String(error.code) : ""} ${"message" in error ? String(error.message) : ""}`
    : String(error ?? "");

  return /email not confirmed|email_not_confirmed/i.test(details);
}

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [showAdminLink, setShowAdminLink] = useState(false);
  const [isPending, setIsPending] = useState(isSupabaseConfigured);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resendBusy, setResendBusy] = useState(false);

  useEffect(() => {
    const authStatus = new URLSearchParams(window.location.search).get("auth");
    let authMessageTimeout: ReturnType<typeof setTimeout> | undefined;
    if (authStatus === "confirmacao-expirada") {
      authMessageTimeout = setTimeout(() => {
        setMessage("Esse link de confirmação expirou ou já foi usado. Peça um novo link abaixo.");
        setCanResendConfirmation(true);
      }, 0);
    } else if (authStatus === "confirmacao-url") {
      authMessageTimeout = setTimeout(() => {
        setMessage("O endereço de confirmação ainda não está permitido pelo serviço de login. A BelaCiclo precisa revisar a configuração do link.");
        setCanResendConfirmation(true);
      }, 0);
    } else if (authStatus === "confirmacao-falhou" || authStatus === "link-invalido") {
      authMessageTimeout = setTimeout(() => {
        setMessage("Não foi possível confirmar este link. Ele pode estar inválido ou expirado. Você pode pedir um novo abaixo.");
        setCanResendConfirmation(true);
      }, 0);
    }

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
    return () => {
      subscription.unsubscribe();
      if (authMessageTimeout) clearTimeout(authMessageTimeout);
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      if (!isSupabaseConfigured) {
        setMessage("O cadastro ainda não está conectado ao Supabase.");
        return;
      }

      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") ?? "").trim();
      const password = String(form.get("password") ?? "");
      const name = String(form.get("name") ?? "").trim();
      const supabase = createSupabaseBrowserClient();
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { name }, emailRedirectTo: getAuthCallbackUrl() },
          });

      if (result.error) {
        setMessage(authFailureMessage(result.error, mode));
        if (mode === "login" && isUnconfirmedEmailError(result.error)) {
          setResendEmail(email);
          setCanResendConfirmation(true);
        }
      } else if (mode === "register" && result.data.user?.identities?.length === 0) {
        setMessage("Este e-mail já tem uma conta. Tente entrar ou use “Esqueci minha senha”.");
      } else if (mode === "login" || result.data.session) {
        window.location.reload();
      } else {
        setResendEmail(email);
        setCanResendConfirmation(true);
        setMessage("Cadastro iniciado. Abra o link de confirmação enviado para seu e-mail para ativar a conta.");
      }
    } catch (error) {
      setMessage(authFailureMessage(error, mode));
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResendBusy(true);
    setResendMessage("");

    try {
      const { error } = await createSupabaseBrowserClient().auth.resend({
        type: "signup",
        email: resendEmail.trim(),
        options: { emailRedirectTo: getAuthCallbackUrl() },
      });
      setResendMessage(error
        ? authFailureMessage(error, "register")
        : "Se houver um cadastro pendente para esse e-mail, enviaremos um novo link. Confira sua caixa de entrada e o spam.");
    } catch (error) {
      setResendMessage(authFailureMessage(error, "register"));
    } finally {
      setResendBusy(false);
    }
  }

  async function signOut() {
    if (!isSupabaseConfigured) return;
    await createSupabaseBrowserClient().auth.signOut();
  }

  if (isPending) return <section className="page-section"><p>Carregando conta…</p></section>;
  if (user) return <section className="page-section account-page"><div className="page-heading"><span className="eyebrow">ÁREA DO CLIENTE</span><h1>Olá, <em>{displayName(user)}.</em></h1><p>Que bom ter você por aqui.</p></div><div className="account-links">{showAdminLink && <Link href="/admin"><span>00</span><div><b>Painel da loja</b><small>Produtos, pedidos e configurações</small></div><Icon name="arrow"/></Link>}<Link href="/minha-conta/pedidos"><span>01</span><div><b>Meus pedidos</b><small>Histórico, status e rastreamento</small></div><Icon name="arrow"/></Link><Link href="/minha-conta/perfil"><span>02</span><div><b>Meus dados</b><small>Atualizar informações pessoais</small></div><Icon name="arrow"/></Link><Link href="/minha-conta/enderecos"><span>03</span><div><b>Meus endereços</b><small>Gerenciar dados de entrega</small></div><Icon name="arrow"/></Link><Link href="/favoritos"><span>04</span><div><b>Meus favoritos</b><small>Suas peças salvas</small></div><Icon name="arrow"/></Link><button onClick={signOut}><span>05</span><div><b>Sair da conta</b><small>Encerrar sessão</small></div><Icon name="arrow"/></button></div></section>;
  return <section className="page-section auth-page"><div className="auth-panel"><span className="eyebrow">ÁREA DO CLIENTE</span><h1>{mode === "login" ? <>Que bom <em>ver você.</em></> : <>Um espaço <em>seu.</em></>}</h1><p>{mode === "login" ? "Entre para acompanhar seus pedidos e favoritos." : "Crie sua conta BelaCiclo."}</p><form onSubmit={submit} className="auth-form">{mode === "register" && <label>Nome completo<input name="name" autoComplete="name" required/></label>}<label>E-mail<input name="email" type="email" autoComplete="email" required/></label><label>Senha<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required/></label>{mode === "login" && <Link href="/minha-conta/recuperar" className="text-link small-link">Esqueci minha senha</Link>}<button className="button button-dark full-button" disabled={busy}>{busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}<Icon name="arrow"/></button><p className="form-feedback" aria-live="polite">{message}</p></form>{mode === "login" && !canResendConfirmation && <button type="button" className="auth-switch" onClick={() => { setResendEmail(""); setResendMessage(""); setCanResendConfirmation(true); }}>Não recebeu o e-mail de confirmação? Reenviar</button>}{canResendConfirmation && <form onSubmit={resendConfirmation} className="auth-form"><label>Reenviar confirmação<input type="email" autoComplete="email" value={resendEmail} onChange={(event) => setResendEmail(event.target.value)} placeholder="Seu e-mail de cadastro" required/></label><button className="button button-outline full-button" disabled={resendBusy}>{resendBusy ? "Enviando…" : "Enviar novo link"}<Icon name="arrow"/></button><p className="form-feedback" aria-live="polite">{resendMessage}</p></form>}<button className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); }}>{mode === "login" ? "Ainda não tem conta? Cadastre-se" : "Já tem conta? Entrar"}</button><p className="auth-note">{isSupabaseConfigured ? "Sua conta é protegida pela autenticação do Supabase." : "O cadastro ficará disponível depois de configurar as chaves do Supabase."}</p></div></section>;
}
