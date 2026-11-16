import type { Metadata } from "next";
import { StoreProvider } from "@/components/store-context";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SupportEmailLink } from "@/components/whatsapp-link";
import { CampaignBar } from "@/components/campaign-bar";
import { getCatalogProducts } from "@/lib/catalog";
import { MotionController } from "@/components/motion-controller";
import { AnalyticsConsent } from "@/components/analytics-consent";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "BelaCiclo — Moda feminina e infantil", template: "%s · BelaCiclo" },
  description: "BelaCiclo — moda feminina e infantil em uma experiência feita para acompanhar cada ciclo.",
  openGraph: { title: "BelaCiclo — Moda feminina e infantil", description: "Uma nova forma de vestir cada ciclo.", type: "website", images: [{ url: "/campaigns/hero-poster.jpg", alt: "Campanha BelaCiclo à luz natural" }] },
  twitter: { card: "summary_large_image", images: ["/campaigns/hero-poster.jpg"] },
  robots: { index: process.env.STORE_INDEXING_ENABLED === "true", follow: process.env.STORE_INDEXING_ENABLED === "true" }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const catalog = await getCatalogProducts();
  return <html lang="pt-BR"><body><StoreProvider catalog={catalog}><MotionController/><CampaignBar/><SiteHeader/><main id="conteudo">{children}</main><SiteFooter/><SupportEmailLink/><AnalyticsConsent/></StoreProvider></body></html>;
}
