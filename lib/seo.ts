import type { Metadata } from "next";

const campaignImage = "/campaigns/hero-poster.jpg";

type PageMetadataInput = {
  title: string;
  description: string;
  canonical?: string;
  noIndex?: boolean;
};

export function createPageMetadata({ title, description, canonical, noIndex = false }: PageMetadataInput): Metadata {
  return {
    title: { absolute: `${title} · BelaCiclo` },
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      title: `${title} · BelaCiclo`,
      description,
      type: "website",
      images: [{ url: campaignImage, alt: "Campanha BelaCiclo à luz natural" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · BelaCiclo`,
      description,
      images: [campaignImage],
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
