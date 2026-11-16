"use client";

import Link from "next/link";

const departments = [
  { label: "Todas", value: "" },
  { label: "Feminina", value: "FEMININA" },
  { label: "Infantil", value: "INFANTIL" },
  { label: "Alfaiataria", value: "Alfaiataria" }
];

export function CatalogFilters({ active }: { active: string }) {
  return <nav className="catalog-filters" aria-label="Filtrar por coleção">{departments.map((department) => <Link key={department.label} className={active === department.value ? "is-active" : ""} href={department.value === "Alfaiataria" ? "/colecoes?categoria=Alfaiataria" : department.value ? `/colecoes?departamento=${department.value}` : "/colecoes"}>{department.label}</Link>)}</nav>;
}
