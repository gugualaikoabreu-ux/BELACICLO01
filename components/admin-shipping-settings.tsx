"use client";

import { FormEvent, useState } from "react";
import { formatCurrency } from "@/lib/config";
import { CURITIBA_METROPOLITAN_MUNICIPALITIES } from "@/lib/shipping/regional";

type Settings = {
  originPostalCode: string;
  fixedShippingCents: number | null;
  freeShippingThresholdCents: number | null;
  regionalShippingEnabled: boolean;
  curitibaMetroShippingCents: number;
  interiorParanaShippingCents: number;
  otherStatesShippingCents: number;
  fixedShippingEnabled: boolean;
  freeShippingEnabled: boolean;
  correiosShippingEnabled: boolean;
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
  settingsTableAvailable: boolean;
  updatedAt?: string | Date | null;
};

type HistoryEntry = {
  id: string;
  actorEmail: string;
  previousSettings: unknown;
  currentSettings: unknown;
  createdAt: string | Date;
};

function amountInput(value: number | null) { return value === null ? "" : (value / 100).toFixed(2); }
function parseAmount(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN;
}
function parseDays(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const days = Number(raw);
  return Number.isSafeInteger(days) ? days : Number.NaN;
}
function isChecked(form: FormData, name: string) { return form.get(name) === "on"; }
function displayRate(value: unknown) { return typeof value === "number" ? formatCurrency(value) : "—"; }
function settingsRecord(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export function AdminShippingSettings({
  initialSettings,
  initialHistory,
  correiosAvailable,
  requiresMigration,
}: {
  initialSettings: Settings;
  initialHistory: HistoryEntry[];
  correiosAvailable: boolean;
  requiresMigration: boolean;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [history, setHistory] = useState(initialHistory);
  const [message, setMessage] = useState(requiresMigration ? "Migration aditiva pendente: as regras não podem ser salvas até validar o banco de teste isolado." : "");
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const curitibaMetroShippingCents = parseAmount(form.get("curitibaMetroShipping"));
    const interiorParanaShippingCents = parseAmount(form.get("interiorParanaShipping"));
    const otherStatesShippingCents = parseAmount(form.get("otherStatesShipping"));
    const fixedShippingCents = parseAmount(form.get("fixedShipping"));
    const freeShippingThresholdCents = parseAmount(form.get("freeShippingThreshold"));
    const estimatedMinDays = parseDays(form.get("estimatedMinDays"));
    const estimatedMaxDays = parseDays(form.get("estimatedMaxDays"));
    const amounts = [curitibaMetroShippingCents, interiorParanaShippingCents, otherStatesShippingCents, fixedShippingCents, freeShippingThresholdCents];
    if (amounts.some((amount) => amount !== null && !Number.isSafeInteger(amount))
      || [curitibaMetroShippingCents, interiorParanaShippingCents, otherStatesShippingCents].some((amount) => amount === null || amount < 1)
      || [estimatedMinDays, estimatedMaxDays].some((days) => days !== null && !Number.isSafeInteger(days))) {
      setMessage("Confira os valores em reais e os prazos informados."); return;
    }

    const payload = {
      originPostalCode: form.get("originPostalCode"),
      regionalShippingEnabled: isChecked(form, "regionalShippingEnabled"),
      curitibaMetroShippingCents,
      interiorParanaShippingCents,
      otherStatesShippingCents,
      fixedShippingEnabled: isChecked(form, "fixedShippingEnabled"),
      fixedShippingCents,
      freeShippingEnabled: isChecked(form, "freeShippingEnabled"),
      freeShippingThresholdCents,
      correiosShippingEnabled: isChecked(form, "correiosShippingEnabled"),
      estimatedMinDays,
      estimatedMaxDays,
    };
    if (payload.fixedShippingEnabled && payload.fixedShippingCents === null) { setMessage("Informe a tarifa fixa antes de ativá-la."); return; }
    if (payload.freeShippingEnabled && payload.freeShippingThresholdCents === null) { setMessage("Informe o limite de compra antes de ativar o frete grátis."); return; }
    if ((estimatedMinDays === null) !== (estimatedMaxDays === null) || (estimatedMinDays !== null && estimatedMaxDays !== null && estimatedMaxDays < estimatedMinDays)) {
      setMessage("Informe os dois prazos estimados; o máximo deve ser igual ou maior que o mínimo."); return;
    }

    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/shipping-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      setMessage(data.message ?? (response.ok ? "Regras salvas." : "Não foi possível salvar as regras."));
      if (response.ok) {
        setSettings(data.settings as Settings);
        const refreshed = await fetch("/api/admin/shipping-settings", { cache: "no-store" });
        const refreshedData = await refreshed.json();
        if (refreshed.ok && Array.isArray(refreshedData.history)) setHistory(refreshedData.history as HistoryEntry[]);
      }
    } catch { setMessage("Não foi possível salvar as regras de frete."); }
    finally { setBusy(false); }
  }

  return <div className="shipping-config-stack">
    <form key={settings.updatedAt ? new Date(settings.updatedAt).toISOString() : "initial"} className="admin-form shipping-settings-form" onSubmit={save}>
      <h2>Configurações de frete</h2>
      <p>Os preços regionais iniciais são os informados pela Bela Ciclo. O município é identificado pelo CEP no servidor, usando o endereço retornado pelo ViaCEP. Nenhum prazo é presumido.</p>

      <fieldset className="shipping-mode-options">
        <legend>Modalidades disponíveis</legend>
        <label><input name="regionalShippingEnabled" type="checkbox" defaultChecked={settings.regionalShippingEnabled}/> Frete regional por município e UF</label>
        <label><input name="fixedShippingEnabled" type="checkbox" defaultChecked={settings.fixedShippingEnabled}/> Frete fixo nacional</label>
        <label><input name="freeShippingEnabled" type="checkbox" defaultChecked={settings.freeShippingEnabled}/> Frete grátis acima do subtotal configurado</label>
        <label><input name="correiosShippingEnabled" type="checkbox" defaultChecked={settings.correiosShippingEnabled}/> Cotações dos Correios (PAC/SEDEX)</label>
        {!correiosAvailable && <small>Correios indisponíveis: faltam credenciais e permissões de contrato. A modalidade não será ativada pelo servidor até a validação dessas configurações.</small>}
      </fieldset>

      <div className="admin-form-grid shipping-rate-grid">
        <label>Curitiba e Região Metropolitana (R$)<input name="curitibaMetroShipping" inputMode="decimal" type="number" min="0.01" step="0.01" defaultValue={amountInput(settings.curitibaMetroShippingCents)} required/></label>
        <label>Interior do Paraná (R$)<input name="interiorParanaShipping" inputMode="decimal" type="number" min="0.01" step="0.01" defaultValue={amountInput(settings.interiorParanaShippingCents)} required/></label>
        <label>Outros estados (R$)<input name="otherStatesShipping" inputMode="decimal" type="number" min="0.01" step="0.01" defaultValue={amountInput(settings.otherStatesShippingCents)} required/></label>
        <label>Tarifa fixa nacional (R$)<input name="fixedShipping" inputMode="decimal" type="number" min="0" step="0.01" defaultValue={amountInput(settings.fixedShippingCents)} placeholder="Desativada até informar tarifa"/></label>
        <label>Frete grátis acima de (R$)<input name="freeShippingThreshold" inputMode="decimal" type="number" min="0.01" step="0.01" defaultValue={amountInput(settings.freeShippingThresholdCents)} placeholder="Desativado até informar limite"/></label>
        <label>CEP de origem<input name="originPostalCode" inputMode="numeric" pattern="\d{5}-?\d{3}" maxLength={9} defaultValue={settings.originPostalCode.replace(/^(\d{5})(\d{3})$/, "$1-$2")} required/></label>
        <label>Prazo mínimo estimado (dias úteis)<input name="estimatedMinDays" type="number" min="1" max="365" step="1" defaultValue={settings.estimatedMinDays ?? ""} placeholder="Opcional"/></label>
        <label>Prazo máximo estimado (dias úteis)<input name="estimatedMaxDays" type="number" min="1" max="365" step="1" defaultValue={settings.estimatedMaxDays ?? ""} placeholder="Opcional"/></label>
      </div>
      <p>O prazo configurado vale para os fretes da loja. Nos Correios, o checkout usa o prazo retornado pela cotação oficial.</p>
      <button className="button button-dark" disabled={busy || requiresMigration}>{busy ? "Salvando…" : "Salvar configurações de frete →"}</button>
      <p className="form-feedback" aria-live="polite">{message}</p>
      <small>CEP de origem: {settings.originPostalCode} · RMC: {formatCurrency(settings.curitibaMetroShippingCents)} · Interior do PR: {formatCurrency(settings.interiorParanaShippingCents)} · Outros estados: {formatCurrency(settings.otherStatesShippingCents)}</small>
    </form>

    <details className="shipping-admin-list">
      <summary>Municípios da Região Metropolitana de Curitiba</summary>
      <p>Classificação RMC baseada na lista oficial da Agência de Assuntos Metropolitanos do Paraná (AMEP), sem usar proximidade geográfica.</p>
      <ul className="shipping-municipality-list">{CURITIBA_METROPOLITAN_MUNICIPALITIES.map((municipality) => <li key={municipality}>{municipality}</li>)}</ul>
      <a href="https://www.amep.pr.gov.br/FAQ/Municipios-da-Regiao-Metropolitana-de-Curitiba" target="_blank" rel="noreferrer">Consultar lista oficial da AMEP ↗</a>
    </details>

    <section className="shipping-admin-list">
      <h2>Histórico de alterações</h2>
      {!history.length ? <p>Nenhuma alteração administrativa registrada ainda.</p> : <ol className="shipping-history-list">{history.map((entry) => {
        const current = settingsRecord(entry.currentSettings);
        const previous = settingsRecord(entry.previousSettings);
        return <li key={entry.id}>
          <b>{new Date(entry.createdAt).toLocaleString("pt-BR")}</b><span>{entry.actorEmail}</span>
          <p>RMC {displayRate(current.curitibaMetroShippingCents)}{previous.curitibaMetroShippingCents === undefined ? "" : ` (antes: ${displayRate(previous.curitibaMetroShippingCents)})`} · Interior PR {displayRate(current.interiorParanaShippingCents)} · Outros estados {displayRate(current.otherStatesShippingCents)}</p>
        </li>;
      })}</ol>}
    </section>
  </div>;
}
