import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Minha conta",
  description: "Acesse seus dados, endereços e pedidos BelaCiclo.",
  noIndex: true,
});

export default function AccountLayout({ children }: { children: ReactNode }) {
  return children;
}
