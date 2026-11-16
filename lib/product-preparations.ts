import type { Product } from "@/lib/products";

/** Officially defined products shown as drafts until photos and stock are confirmed. */
export const productPreparations: Product[] = [
  {
    id: "preparation-calca-alfaiataria",
    slug: "calca-alfaiataria",
    name: "Calça de Alfaiataria",
    department: "FEMININA",
    category: "Alfaiataria",
    price: 16800,
    regularPrice: 16800,
    color: "#172a46",
    colorName: "Foto oficial pendente",
    note: "Calça de alfaiataria com friso.",
    sizes: ["P", "M", "G", "XG"],
    variants: [],
    related: [],
    isDemo: false,
    isPreparation: true,
  },
  {
    id: "preparation-blazer",
    slug: "blazer",
    name: "Blazer",
    department: "FEMININA",
    category: "Alfaiataria",
    price: 18800,
    regularPrice: 18800,
    color: "#172a46",
    colorName: "Foto oficial pendente",
    note: "Tamanhos informados pela loja; disponibilidade ainda não confirmada.",
    sizes: ["P", "M", "G", "XG"],
    variants: [],
    related: [],
    isDemo: false,
    isPreparation: true,
  },
];
