import { z } from "zod";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
import { getCorreiosQuotes, hasCorreiosSettings } from "@/lib/shipping/correios";
import { getDb } from "@/lib/db";
import { effectiveUnitPrice } from "@/lib/pricing";
import { getStoreShippingSettings } from "@/lib/shipping/store-settings";
import { isSameOriginMutationRequest } from "@/lib/security/same-origin";
import { buildConfiguredShippingOptions, attachCorreiosOptions, buildFreeShippingProductOption, isFreeShippingProductOrder } from "@/lib/shipping/options";
import { CepLookupError, lookupViaCep } from "@/lib/address/cep";

const requestSchema = z.object({
  postalCode: z.string().regex(/^\d{5}-?\d{3}$/),
  items: z.array(z.object({ variantId: z.string().min(1).max(180), quantity: z.number().int().min(1).max(10) })).min(1).max(30),
});

export async function POST(request: Request) {
  if (!isSameOriginMutationRequest(request)) return Response.json({ message: "Origem da requisição inválida." }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ message: "Informe um CEP e uma sacola válidos." }, { status: 400 });
  const postalCode = parsed.data.postalCode.replace(/\D/g, "");
  try {
    if (!await enforceRateLimit("shipping", requestIp(request), 20, 60)) return Response.json({ message: "Muitas consultas. Aguarde um minuto." }, { status: 429 });
    const ids = parsed.data.items.map((item) => item.variantId);
    if (new Set(ids).size !== ids.length) return Response.json({ message: "A sacola contém tamanhos repetidos." }, { status: 400 });
    const variants = await getDb().productVariant.findMany({ where: { id: { in: ids }, active: true, product: { active: true, demo: false } }, include: { product: true } });
    if (variants.length !== ids.length) return Response.json({ message: "Uma peça da sacola não está disponível." }, { status: 409 });
    const byId = new Map(variants.map((variant) => [variant.id, variant]));
    for (const item of parsed.data.items) {
      const variant = byId.get(item.variantId);
      if (!variant || variant.stock - variant.reserved < item.quantity) return Response.json({ message: "Estoque insuficiente para uma das variações." }, { status: 409 });
    }
    const subtotal = parsed.data.items.reduce((sum, item) => {
      const product = byId.get(item.variantId)!.product;
      return sum + effectiveUnitPrice(product.price, product.promotionalPrice) * item.quantity;
    }, 0);
    const settings = await getStoreShippingSettings();
    let destination: { city: string; state: string } | null = null;
    let lookupUnavailable = false;
    try {
      destination = await lookupViaCep(postalCode);
    } catch (error) {
      if (error instanceof CepLookupError && error.kind === "not_found") return Response.json({ message: "CEP não encontrado. Confira o endereço antes de consultar o frete." }, { status: 404 });
      if (!(error instanceof CepLookupError) || error.kind !== "unavailable") throw error;
      lookupUnavailable = true;
    }

    const freeShippingForProduct = isFreeShippingProductOrder(parsed.data.items.map((item) => ({ productSlug: byId.get(item.variantId)!.product.slug })));
    const options = freeShippingForProduct
      ? [buildFreeShippingProductOption(settings)]
      : buildConfiguredShippingOptions(settings, destination, subtotal);
    let correiosUnavailable = false;
    if (!freeShippingForProduct && settings.correiosShippingEnabled && hasCorreiosSettings()) {
      try {
        const services = await getCorreiosQuotes(postalCode, parsed.data.items, settings.originPostalCode);
        options.push(...attachCorreiosOptions([], services));
      } catch {
        correiosUnavailable = true;
      }
    }

    if (!options.length && lookupUnavailable) return Response.json({ message: "Não foi possível validar o município pelo CEP. Tente novamente para calcular o frete regional." }, { status: 503 });
    if (!options.length) {
      const message = !settings.settingsTableAvailable
        ? "A configuração de frete ainda depende da migration regional validada em ambiente de teste."
        : correiosUnavailable
          ? "A cotação dos Correios está indisponível e não há outra modalidade ativa para este destino."
          : "Não há uma modalidade de entrega ativa para este destino. Consulte a loja para configurar uma tarifa real.";
      return Response.json({ postalCode, method: "manual_pending", message, subtotalCents: subtotal }, { status: 200 });
    }

    const messages = [
      lookupUnavailable ? "Município não confirmado agora; foram exibidas somente modalidades que não dependem da cidade." : "Valores calculados no servidor para o CEP consultado.",
      correiosUnavailable ? "A cotação dos Correios falhou; as demais modalidades disponíveis continuam válidas." : "",
    ].filter(Boolean);
    return Response.json({
      postalCode,
      city: destination?.city ?? null,
      state: destination?.state ?? null,
      method: "configured_options",
      services: options,
      message: messages.join(" "),
      subtotalCents: subtotal,
    });
  } catch {
    return Response.json({ message: "Não foi possível consultar a entrega." }, { status: 503 });
  }
}
