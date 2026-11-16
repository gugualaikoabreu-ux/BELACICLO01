import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Seus favoritos",
  description: "Consulte as peças que você salvou na BelaCiclo.",
  noIndex: true,
});

export default function FavoritesLayout({ children }: { children: ReactNode }) {
  return children;
}
