export type ProductDepartment = "FEMININA" | "INFANTIL";

export function categorySlug(category: string, department: ProductDepartment) {
  const normalized = category.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
  return `${department.toLowerCase()}-${normalized || "geral"}`;
}
