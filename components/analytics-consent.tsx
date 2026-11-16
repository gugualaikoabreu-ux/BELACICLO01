"use client";
import { useEffect, useState } from "react";
export function AnalyticsConsent() {
  const [choice, setChoice] = useState<string | null>(null);
  useEffect(() => { const stored = localStorage.getItem("belaciclo-analytics-consent"); queueMicrotask(() => setChoice(stored)); }, []);
  const id = process.env.NEXT_PUBLIC_GA4_ID;
  if (!id || choice) return null;
  function decide(value: "accepted" | "declined") {
    localStorage.setItem("belaciclo-analytics-consent", value); setChoice(value);
    if (value === "accepted" && id) {
      const script = document.createElement("script"); script.async = true; script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`; document.head.appendChild(script);
      window.dataLayer = window.dataLayer ?? []; window.gtag = (...args: unknown[]) => { window.dataLayer!.push(args); };
      window.gtag("js", new Date()); window.gtag("config", id, { anonymize_ip: true });
    }
  }
  return <aside className="consent-banner" aria-label="Preferências de privacidade"><div><b>Suas escolhas importam.</b><p>Com sua autorização, usamos analytics para entender o uso da loja e melhorar a experiência. Você pode escolher agora.</p></div><div><button onClick={() => decide("declined")}>Recusar</button><button onClick={() => decide("accepted")}>Aceitar analytics</button></div></aside>;
}
