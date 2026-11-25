"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useStore } from "@/components/store-context";
import { PixPayment } from "@/components/pix-payment";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatCurrency } from "@/lib/config";
import { CheckoutAddressFields } from "@/components/checkout-address-fields";
import { isValidCep, normalizeCep } from "@/lib/address/cep";

type CheckoutPayment = { orderNumber: string; subtotal: number; discount: number; shipping: number; shippingServiceName: string | null; shippingDeliveryMinDays: number | null; shippingDeliveryMaxDays: number | null; total: number; paymentStatus: string; copyPaste: string; recipientKey: string; recipientName: string; qrCodeDataUrl: string; expiresAt: string };
type ShippingOption = { code: string; name: string; method: "regional" | "free_threshold" | "free_product" | "fixed_store_rate" | "correios"; shippingCents: number; deliveryMinDays: number | null; deliveryMaxDays: number | null };
type ShippingQuote = { shippingCents?: number; postalCode: string; method: string; message: string; services?: ShippingOption[]; cartSignature?: string };
type CouponQuote = { code: string; subtotalCents: number; discountCents: number; discountedSubtotalCents: number; cartSignature: string };

export default function CheckoutPage() {
  const { cart, catalog, clearCart } = useStore();
  const lines = useMemo(() => cart.map((line) => ({ ...line, product: catalog.find((product) => product.id === line.productId), variant: catalog.find((product) => product.id === line.productId)?.variants.find((variant) => variant.id === line.variantId) })).filter((line) => line.product && line.variant), [cart, catalog]);
  const subtotal = lines.reduce((sum, line) => sum + line.product!.price * line.quantity, 0);
  const cartSignature = cart.map((line) => `${line.variantId}:${line.quantity}`).sort().join("|");
  const [user, setUser] = useState<User | null>(null);
  const [shipping, setShipping] = useState<ShippingQuote | null>(null);
  const [selectedServiceCode, setSelectedServiceCode] = useState("");
  const [payment, setPayment] = useState<CheckoutPayment | null>(null);
  const [message, setMessage] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponQuote, setCouponQuote] = useState<CouponQuote | null>(null);
  const [couponMessage, setCouponMessage] = useState("");
  const activeCouponQuote = couponQuote?.cartSignature === cartSignature ? couponQuote : null;
  const [busy, setBusy] = useState(false);
  const [shippingBusy, setShippingBusy] = useState(false);
  const idempotencyKey = useRef("");
  const shippingQuoteRequest = useRef(0);
  const lastShippingPostalCode = useRef("");
  const currentShippingQuote = shipping?.cartSignature === cartSignature ? shipping : null;
  const shippingAmount = currentShippingQuote?.method === "manual_pending" ? null : currentShippingQuote?.services?.find((service) => service.code === selectedServiceCode)?.shippingCents ?? currentShippingQuote?.shippingCents ?? null;

  const quoteShipping = useCallback(async (postalCodeValue: string) => {
    const postalCode = normalizeCep(postalCodeValue);
    const requestId = ++shippingQuoteRequest.current;
    setMessage(""); setShipping(null); setSelectedServiceCode("");
    if (!isValidCep(postalCode)) { lastShippingPostalCode.current = ""; setMessage("Informe um CEP válido com 8 dígitos para consultar a entrega."); setShippingBusy(false); return; }
    lastShippingPostalCode.current = postalCode;
    setShippingBusy(true);
    try {
      const quoteResponse = await fetch("/api/shipping/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postalCode, items: lines.map((line) => ({ variantId: line.variant!.id, quantity: line.quantity })) }) });
      const quoteData = await quoteResponse.json();
      if (requestId !== shippingQuoteRequest.current) return;
      if (!quoteResponse.ok) { setMessage(quoteData.message ?? "O valor da entrega ainda não está configurado."); return; }
      const quote = { ...quoteData, cartSignature } as ShippingQuote;
      setShipping(quote);
      if (quote.services?.length === 1) setSelectedServiceCode(quote.services[0].code);
      const serviceCount = quote.services?.length ?? 0;
      setMessage(serviceCount > 1 ? "Escolha uma modalidade para atualizar o total do pedido." : serviceCount === 1 ? "Frete calculado no servidor para este CEP." : quote.message ?? "Entrega consultada.");
    } catch { if (requestId === shippingQuoteRequest.current) setMessage("Não foi possível consultar a entrega. Tente novamente."); }
    finally { if (requestId === shippingQuoteRequest.current) setShippingBusy(false); }
  }, [lines, cartSignature]);

  const invalidateShippingQuote = useCallback(() => {
    shippingQuoteRequest.current += 1;
    lastShippingPostalCode.current = "";
    setShipping(null);
    setSelectedServiceCode("");
    setShippingBusy(false);
  }, []);

  const handlePostalCodeResolved = useCallback((postalCode: string) => {
    void quoteShipping(postalCode);
  }, [quoteShipping]);

  const handleAddressLocationChange = useCallback((postalCode: string) => {
    void quoteShipping(postalCode);
  }, [quoteShipping]);

  useEffect(() => {
    const postalCode = lastShippingPostalCode.current;
    if (!postalCode || !lines.length) return;
    void quoteShipping(postalCode);
  }, [cartSignature, lines.length, quoteShipping]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  async function applyCoupon() {
    if (!user) { setCouponMessage("Entre na sua conta para aplicar um cupom."); return; }
    if (!couponCode.trim() || !lines.length) { setCouponMessage("Informe o cupom e confira sua sacola."); return; }
    setBusy(true); setCouponMessage("");
    try {
      const response = await fetch("/api/coupons/validate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: couponCode, items: lines.map((line) => ({ variantId: line.variant!.id, quantity: line.quantity })) }) });
      const data = await response.json();
      if (!response.ok) { setCouponQuote(null); setCouponMessage(data.message ?? "Este cupom não pode ser aplicado."); return; }
      setCouponQuote({ ...data as Omit<CouponQuote, "cartSignature">, cartSignature }); setCouponCode(data.code); setCouponMessage("Cupom aplicado. O servidor confirmará o desconto novamente ao finalizar.");
    } catch { setCouponMessage("Não foi possível validar o cupom agora."); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    if (shippingBusy) { setMessage("Aguarde a consulta do frete terminar."); setBusy(false); return; }
    if (!user) { setMessage("Entre na sua conta verificada antes de finalizar o pedido."); setBusy(false); return; }
    if (!lines.length) { setMessage("A sacola está vazia ou alguma variação deixou de estar disponível."); setBusy(false); return; }
    const form = new FormData(event.currentTarget);
    const postalCodeInput = String(form.get("postalCode") ?? "");
    if (!isValidCep(postalCodeInput)) { setMessage("Informe um CEP válido com 8 dígitos."); setBusy(false); return; }
    const postalCode = normalizeCep(postalCodeInput);
    const missingAddressField = ["recipient", "street", "number", "neighborhood", "city", "state"].some((field) => !String(form.get(field) ?? "").trim());
    if (missingAddressField || String(form.get("state") ?? "").trim().length !== 2) { setMessage("Preencha destinatário, rua, número, bairro, cidade e UF para continuar."); setBusy(false); return; }
    try {
      let quote = shipping;
      if (!quote || quote.postalCode !== postalCode || quote.cartSignature !== cartSignature) {
        const quoteResponse = await fetch("/api/shipping/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postalCode, items: lines.map((line) => ({ variantId: line.variant!.id, quantity: line.quantity })) }) });
        const quoteData = await quoteResponse.json();
        if (!quoteResponse.ok) { setMessage(quoteData.message ?? "O valor da entrega ainda não está configurado."); setBusy(false); return; }
        quote = { ...quoteData, cartSignature } as ShippingQuote; setShipping(quote);
        const oneOptionCode = quote.services?.length === 1 ? quote.services[0].code : "";
        setSelectedServiceCode(oneOptionCode);
        if (quote.services?.length) { setMessage(quote.services.length === 1 ? "O frete foi recalculado para a sacola atual. Revise o total e finalize novamente." : "O frete foi recalculado para a sacola atual. Escolha uma modalidade e finalize novamente."); setBusy(false); return; }
      }

      const selectedService = quote.services?.find((service) => service.code === selectedServiceCode);
      if (quote.services?.length && !selectedService) { setMessage("Selecione uma modalidade de entrega dos Correios."); setBusy(false); return; }
      if (!selectedService && (quote.method === "manual_pending" || quote.shippingCents === undefined)) {
        setMessage("Ainda não há uma tarifa real para este CEP. A Bela Ciclo precisa confirmar o frete antes de concluir o pedido.");
        setBusy(false);
        return;
      }

      const body = {
        customerName: String(form.get("customerName")),
        customerPhone: String(form.get("customerPhone")),
        ...(selectedService ? { shippingServiceCode: selectedService.code, shippingAmountCents: selectedService.shippingCents } : {}),
        ...(activeCouponQuote ? { couponCode: activeCouponQuote.code } : {}),
        address: {
          recipient: String(form.get("recipient")), postalCode, street: String(form.get("street")), number: String(form.get("number")),
          complement: String(form.get("complement")), reference: String(form.get("reference")), neighborhood: String(form.get("neighborhood")), city: String(form.get("city")), state: String(form.get("state")),
        },
        items: lines.map((line) => ({ variantId: line.variant!.id, quantity: line.quantity })),
      };
      if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
      const response = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey.current }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message ?? "Não foi possível criar seu pedido."); setBusy(false); return; }
      setPayment(data as CheckoutPayment); clearCart();
    } catch { setMessage("Não foi possível iniciar o checkout. Tente novamente."); }
    finally { setBusy(false); }
  }

  if (payment) return <section className="page-section checkout-page"><div className="page-heading"><span className="eyebrow">PIX · PEDIDO {payment.orderNumber}</span><h1>Pedido <em>recebido.</em></h1><p>O estoque fica reservado até o prazo mostrado abaixo.</p></div><div className="cart-summary checkout-order-summary"><h2>Resumo do pedido</h2><div><span>Produtos</span><b>{formatCurrency(payment.subtotal)}</b></div>{payment.discount > 0 && <div><span>Cupom aplicado</span><b>− {formatCurrency(payment.discount)}</b></div>}<div><span>{payment.shippingServiceName ?? "Entrega"}</span><b>{formatCurrency(payment.shipping)}</b></div>{payment.shippingDeliveryMinDays !== null && payment.shippingDeliveryMaxDays !== null && <div><span>Prazo estimado</span><b>{payment.shippingDeliveryMinDays === payment.shippingDeliveryMaxDays ? payment.shippingDeliveryMinDays : `${payment.shippingDeliveryMinDays}–${payment.shippingDeliveryMaxDays}`} dias úteis</b></div>}<div className="summary-total"><span>Total do pedido</span><b>{formatCurrency(payment.total)}</b></div></div><PixPayment {...payment}/><Link className="button button-outline" href={`/pedido/${encodeURIComponent(payment.orderNumber)}`}>Acompanhar pedido →</Link></section>;

  return <section className="page-section checkout-page">
    <div className="page-heading"><span className="eyebrow">FINALIZAÇÃO</span><h1>Seu pedido <em>começa aqui.</em></h1><p>O pedido só avança após a confirmação válida do pagamento.</p></div>
    {!isSupabaseConfigured && <div className="checkout-status"><div><h2>Autenticação não configurada.</h2><p>Conecte o projeto Supabase para iniciar sessão e finalizar compras.</p></div></div>}
    {isSupabaseConfigured && !user && <div className="checkout-status"><div><h2>Entre na sua conta.</h2><p>É necessário acessar uma conta com e-mail confirmado para registrar o pedido.</p><Link className="button button-dark" href="/minha-conta">Entrar na conta →</Link></div></div>}
    {!lines.length ? <div className="empty-state"><h2>Sua sacola está vazia.</h2><Link className="button button-outline" href="/colecoes">Explorar coleção →</Link></div> : <div className="checkout-layout"><form className="admin-form checkout-form" onSubmit={submit}>
      <h2>Entrega</h2>
      <div className="admin-form-grid checkout-contact-grid">
        <label>Seu nome<input name="customerName" autoComplete="name" defaultValue={typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : ""} required/></label>
        <label>Telefone<input name="customerPhone" type="tel" autoComplete="tel" required/></label>
      </div>
      <CheckoutAddressFields
        defaultRecipient={typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : ""}
        onPostalCodeChange={invalidateShippingQuote}
        onPostalCodeResolved={handlePostalCodeResolved}
        onAddressLocationChange={handleAddressLocationChange}
      />
      <button className="shipping-quote-button" type="button" disabled={shippingBusy} onClick={(event) => { const form = event.currentTarget.form; const postalCode = String(new FormData(form ?? undefined).get("postalCode") ?? ""); void quoteShipping(postalCode); }}>{shippingBusy ? "Consultando frete…" : "Consultar entrega"} →</button>
      {currentShippingQuote?.services?.length ? <fieldset className="shipping-options"><legend>Modalidades disponíveis</legend>{currentShippingQuote.services.map((service) => <label key={service.code} className={selectedServiceCode === service.code ? "selected" : ""}><input type="radio" name="shippingService" value={service.code} checked={selectedServiceCode === service.code} onChange={() => setSelectedServiceCode(service.code)}/><span><b>{service.name}</b><small>{service.deliveryMinDays === null || service.deliveryMaxDays === null ? "Prazo estimado ainda não configurado" : service.deliveryMinDays === service.deliveryMaxDays ? `${service.deliveryMinDays} dias úteis${service.method === "correios" ? " · informado pelos Correios" : " · estimativa da loja"}` : `${service.deliveryMinDays}–${service.deliveryMaxDays} dias úteis · estimativa da loja`}</small></span><strong>{formatCurrency(service.shippingCents)}</strong></label>)}</fieldset> : currentShippingQuote && <p className="auth-note">{currentShippingQuote.message}{currentShippingQuote.method !== "manual_pending" && currentShippingQuote.shippingCents !== undefined ? ` · ${formatCurrency(currentShippingQuote.shippingCents)}` : ""}</p>}
      <h2>Desconto</h2><div className="checkout-coupon-entry"><label>Código do cupom<input value={couponCode} onChange={(event) => { setCouponCode(event.target.value); setCouponQuote(null); setCouponMessage(""); }} maxLength={32} autoComplete="off"/></label>{activeCouponQuote ? <button className="button button-outline" type="button" onClick={() => { setCouponQuote(null); setCouponCode(""); setCouponMessage("Cupom removido."); }}>Remover cupom</button> : <button className="button button-outline" type="button" onClick={() => void applyCoupon()} disabled={busy || !user}>Aplicar cupom</button>}</div>{activeCouponQuote && <p className="auth-note">{activeCouponQuote.code}: desconto de {formatCurrency(activeCouponQuote.discountCents)}.</p>}<p className="form-feedback" aria-live="polite">{couponMessage}</p>
      <h2>Pagamento</h2><p>O pedido só será registrado depois que o frete tiver uma tarifa válida, incluindo frete grátis quando aplicável. O PIX é manual e só será confirmado após conferência no banco.</p>
      <button className="button button-dark" disabled={busy || shippingBusy || !user || !isSupabaseConfigured}>{busy ? "Preparando pedido…" : "Criar pedido e gerar PIX manual"} →</button>
      <p className="form-feedback" aria-live="polite">{message}</p>
    </form><aside className="cart-summary"><h2>Resumo do pedido</h2>{lines.map((line) => <div key={line.variant!.id}><span>{line.product!.name} · {line.color || "Única"} · {line.size} × {line.quantity}</span><b>{formatCurrency(line.product!.price * line.quantity)}</b></div>)}<div><span>Subtotal</span><b>{formatCurrency(subtotal)}</b></div>{activeCouponQuote && <div><span>Cupom {activeCouponQuote.code}</span><b>− {formatCurrency(activeCouponQuote.discountCents)}</b></div>}<div><span>Entrega</span><b>{shippingAmount !== null ? formatCurrency(shippingAmount) : "A calcular"}</b></div><div className="summary-total"><span>{shippingAmount !== null ? "Total estimado" : "Total após frete"}</span><b>{shippingAmount !== null ? formatCurrency(subtotal - (activeCouponQuote?.discountCents ?? 0) + shippingAmount) : "Aguardando tarifa"}</b></div><p className="auth-note">O frete usa tarifas da loja ou dos Correios; a peça com frete grátis mantém essa condição quando comprada sozinha.</p></aside></div>}
  </section>;
}
