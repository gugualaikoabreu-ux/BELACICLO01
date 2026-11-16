import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Sacola de compras",
  description: "Revise os produtos escolhidos na sacola BelaCiclo.",
  noIndex: true,
});

export default function CartLayout({ children }: { children: ReactNode }) {
  return children;
}
