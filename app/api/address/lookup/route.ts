import { CepLookupError, isValidCep, lookupViaCep } from "@/lib/address/cep";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const postalCode = new URL(request.url).searchParams.get("cep") ?? "";
  if (!isValidCep(postalCode)) {
    return Response.json({ message: "Informe um CEP válido com 8 dígitos." }, { status: 400 });
  }

  try {
    const address = await lookupViaCep(postalCode);
    return Response.json(address, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (error) {
    if (error instanceof CepLookupError) {
      const status = error.kind === "invalid" ? 400 : error.kind === "not_found" ? 404 : 502;
      return Response.json({ message: error.message }, { status });
    }
    return Response.json({ message: "Não foi possível consultar o CEP. Preencha o endereço manualmente ou tente novamente." }, { status: 502 });
  }
}
