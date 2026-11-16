export type Product = {
  id: string;
  slug: string;
  name: string;
  department: "FEMININA" | "INFANTIL";
  category: string;
  price: number;
  regularPrice?: number;
  color: string;
  colorName: string;
  note: string;
  sizes: string[];
  variants: { id: string; size: string | null; color: string | null; available: boolean }[];
  related: string[];
  isDemo: boolean;
  isPreparation?: boolean;
  imageUrl?: string;
  imageAlt?: string;
  images?: { url: string; alt: string }[];
};

// Catalog records are loaded from the database. These are disclosed drafts for
// the two items the store already defined; they can never be purchased.
export const products: Product[] = [];

export const getProduct = (idOrSlug: string) => products.find((product) => product.id === idOrSlug || product.slug === idOrSlug);
