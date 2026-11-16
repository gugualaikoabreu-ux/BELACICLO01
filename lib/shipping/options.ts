import { classifyRegionalDestination } from "./regional.ts";

export type ShippingServiceMethod = "regional" | "free_threshold" | "fixed_store_rate" | "correios";

export type ShippingOption = {
  code: string;
  name: string;
  method: ShippingServiceMethod;
  shippingCents: number;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
};

export type ShippingOptionSettings = {
  regionalShippingEnabled: boolean;
  curitibaMetroShippingCents: number;
  interiorParanaShippingCents: number;
  otherStatesShippingCents: number;
  fixedShippingEnabled: boolean;
  fixedShippingCents: number | null;
  freeShippingEnabled: boolean;
  freeShippingThresholdCents: number | null;
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
};

export function buildConfiguredShippingOptions(
  settings: ShippingOptionSettings,
  destination: { city: string; state: string } | null,
  subtotalCents: number,
): ShippingOption[] {
  const options: ShippingOption[] = [];
  if (settings.regionalShippingEnabled && destination) {
    const zone = classifyRegionalDestination(destination.city, destination.state);
    if (zone === "CURITIBA_METRO") options.push({
      code: "BELACICLO_RMC",
      name: "Frete regional · Curitiba e Região Metropolitana",
      method: "regional",
      shippingCents: settings.curitibaMetroShippingCents,
      deliveryMinDays: settings.estimatedMinDays,
      deliveryMaxDays: settings.estimatedMaxDays,
    });
    if (zone === "PARANA_INTERIOR") options.push({
      code: "BELACICLO_PR_INTERIOR",
      name: "Frete regional · Interior do Paraná",
      method: "regional",
      shippingCents: settings.interiorParanaShippingCents,
      deliveryMinDays: settings.estimatedMinDays,
      deliveryMaxDays: settings.estimatedMaxDays,
    });
    if (zone === "OTHER_STATES") options.push({
      code: "BELACICLO_OUTROS_ESTADOS",
      name: "Frete regional · Outros estados",
      method: "regional",
      shippingCents: settings.otherStatesShippingCents,
      deliveryMinDays: settings.estimatedMinDays,
      deliveryMaxDays: settings.estimatedMaxDays,
    });
  }

  if (settings.freeShippingEnabled && settings.freeShippingThresholdCents !== null && subtotalCents >= settings.freeShippingThresholdCents) options.push({
    code: "BELACICLO_FRETE_GRATIS",
    name: "Frete grátis · Regra da loja",
    method: "free_threshold",
    shippingCents: 0,
    deliveryMinDays: settings.estimatedMinDays,
    deliveryMaxDays: settings.estimatedMaxDays,
  });

  if (settings.fixedShippingEnabled && settings.fixedShippingCents !== null) options.push({
    code: "BELACICLO_FRETE_FIXO",
    name: "Frete fixo nacional · Regra da loja",
    method: "fixed_store_rate",
    shippingCents: settings.fixedShippingCents,
    deliveryMinDays: settings.estimatedMinDays,
    deliveryMaxDays: settings.estimatedMaxDays,
  });

  return options;
}

export function attachCorreiosOptions(options: ShippingOption[], services: Array<{ code: string; name: string; shippingCents: number; deliveryDays: number }>) {
  return [
    ...options,
    ...services.map((service): ShippingOption => ({
      code: service.code,
      name: service.name,
      method: "correios",
      shippingCents: service.shippingCents,
      deliveryMinDays: service.deliveryDays,
      deliveryMaxDays: service.deliveryDays,
    })),
  ];
}

export function selectServerShippingOption(options: ShippingOption[], code?: string, submittedAmountCents?: number) {
  const selected = code ? options.find((option) => option.code === code) : options.length === 1 ? options[0] : undefined;
  if (!selected) throw new Error(options.length > 1 ? "Selecione uma modalidade de entrega disponível." : "A tarifa de entrega não está disponível para este CEP.");
  if (submittedAmountCents !== undefined && submittedAmountCents !== selected.shippingCents) throw new Error("O valor do frete foi atualizado. Consulte novamente e confirme o novo valor.");
  return selected;
}
