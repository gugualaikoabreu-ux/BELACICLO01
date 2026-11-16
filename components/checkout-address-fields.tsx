"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  clearCepAddress,
  CepLookupResult,
  formatCep,
  isValidCep,
  mergeCepAddress,
  normalizeCep,
  updateCepAddressField,
} from "@/lib/address/cep";

type AddressFields = { street: string; neighborhood: string; city: string; state: string };
type LookupStatus = "idle" | "loading" | "found" | "error" | "manual";

export function CheckoutAddressFields({
  defaultRecipient,
  onPostalCodeChange,
  onPostalCodeResolved,
  onAddressLocationChange,
}: {
  defaultRecipient: string;
  onPostalCodeChange: () => void;
  onPostalCodeResolved: (postalCode: string) => void;
  onAddressLocationChange: (postalCode: string) => void;
}) {
  const [postalCode, setPostalCode] = useState("");
  const [fields, setFields] = useState<AddressFields>({ street: "", neighborhood: "", city: "", state: "" });
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const [lookupMessage, setLookupMessage] = useState("");
  const [retryNumber, setRetryNumber] = useState(0);
  const cache = useRef(new Map<string, CepLookupResult>());
  const requestedPostalCode = useRef("");
  const resolvedPostalCode = useRef("");
  const controller = useRef<AbortController | null>(null);
  const onPostalCodeResolvedRef = useRef(onPostalCodeResolved);
  const onAddressLocationChangeRef = useRef(onAddressLocationChange);

  useEffect(() => {
    onPostalCodeResolvedRef.current = onPostalCodeResolved;
  }, [onPostalCodeResolved]);

  useEffect(() => {
    onAddressLocationChangeRef.current = onAddressLocationChange;
  }, [onAddressLocationChange]);

  const lookupAddress = useCallback(async (cep: string, force = false) => {
    const cached = cache.current.get(cep);
    if (cached && !force) {
      if (resolvedPostalCode.current !== cep) {
        setFields((current) => mergeCepAddress(current, cached));
        resolvedPostalCode.current = cep;
        onPostalCodeResolvedRef.current(cep);
      }
      setLookupStatus("found");
      setLookupMessage("Endereço preenchido. Confira os dados; você pode editá-los.");
      return;
    }
    if (!force && requestedPostalCode.current === cep) return;

    controller.current?.abort();
    const activeController = new AbortController();
    controller.current = activeController;
    requestedPostalCode.current = cep;
    setLookupStatus("loading");
    setLookupMessage("Consultando o CEP…");

    try {
      const response = await fetch(`/api/address/lookup?cep=${encodeURIComponent(cep)}`, { signal: activeController.signal });
      const result = await response.json() as CepLookupResult | { message?: string };
      if (!response.ok) throw new Error("message" in result ? result.message : undefined);
      if (activeController.signal.aborted) return;

      const address = result as CepLookupResult;
      cache.current.set(cep, address);
      setFields((current) => mergeCepAddress(current, address));
      resolvedPostalCode.current = cep;
      setLookupStatus("found");
      setLookupMessage("Endereço preenchido. Confira os dados; você pode editá-los.");
      onPostalCodeResolvedRef.current(cep);
    } catch (error) {
      if (activeController.signal.aborted) return;
      requestedPostalCode.current = "";
      setLookupStatus("error");
      setLookupMessage(error instanceof Error && error.message
        ? error.message
        : "Não foi possível consultar o CEP. Confira sua conexão ou preencha o endereço manualmente.");
    }
  }, []);

  useEffect(() => {
    const cep = normalizeCep(postalCode);
    if (!isValidCep(postalCode)) {
      controller.current?.abort();
      requestedPostalCode.current = "";
      return;
    }
    if (resolvedPostalCode.current === cep || requestedPostalCode.current === cep) return;
    const timeout = window.setTimeout(() => void lookupAddress(cep), 300);
    return () => {
      window.clearTimeout(timeout);
      controller.current?.abort();
    };
  }, [postalCode, retryNumber, lookupAddress]);

  function handlePostalCodeChange(event: ChangeEvent<HTMLInputElement>) {
    const next = formatCep(event.currentTarget.value);
    const currentCep = normalizeCep(postalCode);
    const nextCep = normalizeCep(next);
    setPostalCode(next);
    onPostalCodeChange();

    if (currentCep.length === 8 && currentCep !== nextCep) {
      controller.current?.abort();
      requestedPostalCode.current = "";
      resolvedPostalCode.current = "";
      setFields((current) => clearCepAddress(current));
      setLookupStatus("idle");
      setLookupMessage("");
    } else if (!isValidCep(next)) {
      setLookupStatus("idle");
      setLookupMessage("");
    }
  }

  function updateField(field: keyof AddressFields, value: string) {
    setFields((current) => updateCepAddressField(current, field, value));
    if (lookupStatus === "error" || lookupStatus === "found") {
      setLookupStatus("manual");
      setLookupMessage("Endereço editado manualmente. Confira os dados antes de continuar.");
    }
  }

  const validCep = isValidCep(postalCode);
  return <div className="admin-form-grid checkout-address-grid">
    <label>Destinatário<input name="recipient" autoComplete="shipping name" defaultValue={defaultRecipient} required minLength={2} maxLength={120}/></label>
    <div className="checkout-cep-field">
      <label htmlFor="checkout-postal-code">CEP<input
        id="checkout-postal-code"
        name="postalCode"
        value={postalCode}
        onChange={handlePostalCodeChange}
        autoComplete="shipping postal-code"
        inputMode="numeric"
        pattern="\d{5}-\d{3}"
        title="Digite um CEP com 8 dígitos."
        maxLength={9}
        placeholder="00000-000"
        required
      /></label>
      <div className={`checkout-cep-status checkout-cep-status--${lookupStatus}`} aria-live="polite" role={lookupStatus === "error" ? "alert" : "status"}>
        {lookupStatus === "loading" && <span className="checkout-cep-spinner" aria-hidden="true"/>}
        {lookupMessage || (validCep ? "CEP completo; consultando automaticamente." : "Digite os 8 dígitos do CEP.")}
      </div>
      {lookupStatus === "error" && validCep && <button className="checkout-cep-retry" type="button" onClick={() => { requestedPostalCode.current = ""; setRetryNumber((current) => current + 1); }}>Tentar consulta novamente</button>}
    </div>
    <label>Rua / logradouro<input name="street" autoComplete="shipping address-line1" value={fields.street} onChange={(event) => updateField("street", event.currentTarget.value)} required minLength={2} maxLength={180}/></label>
    <label>Número<input name="number" autoComplete="shipping address-line2" required minLength={1} maxLength={30}/></label>
    <label>Complemento (opcional)<input name="complement" autoComplete="shipping address-line3" maxLength={100}/></label>
    <label>Referência (opcional)<input name="reference" maxLength={180}/></label>
    <label>Bairro<input name="neighborhood" autoComplete="address-level3" value={fields.neighborhood} onChange={(event) => updateField("neighborhood", event.currentTarget.value)} required minLength={2} maxLength={100}/></label>
    <label>Cidade<input name="city" autoComplete="shipping address-level2" value={fields.city} onChange={(event) => updateField("city", event.currentTarget.value)} onBlur={() => { if (validCep) onAddressLocationChangeRef.current(normalizeCep(postalCode)); }} required minLength={2} maxLength={100}/></label>
    <label>Estado (UF)<input name="state" autoComplete="shipping address-level1" value={fields.state} onChange={(event) => updateField("state", event.currentTarget.value)} onBlur={() => { if (validCep) onAddressLocationChangeRef.current(normalizeCep(postalCode)); }} required minLength={2} maxLength={2}/></label>
  </div>;
}
