import { z } from "zod";
import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { getStoreShippingSettings } from "@/lib/shipping/store-settings";
import { hasCorreiosSettings } from "@/lib/shipping/correios";

const daysSchema = z.number().int().min(1).max(365).nullable();
const schema = z.object({
  originPostalCode: z.string().regex(/^\d{5}-?\d{3}$/).transform((value) => value.replace(/\D/g, "")),
  regionalShippingEnabled: z.boolean(),
  curitibaMetroShippingCents: z.number().int().min(1).max(10_000_000),
  interiorParanaShippingCents: z.number().int().min(1).max(10_000_000),
  otherStatesShippingCents: z.number().int().min(1).max(10_000_000),
  fixedShippingEnabled: z.boolean(),
  fixedShippingCents: z.number().int().min(0).max(10_000_000).nullable(),
  freeShippingEnabled: z.boolean(),
  freeShippingThresholdCents: z.number().int().positive().max(100_000_000).nullable(),
  correiosShippingEnabled: z.boolean(),
  estimatedMinDays: daysSchema,
  estimatedMaxDays: daysSchema,
}).superRefine((value, context) => {
  if (value.fixedShippingEnabled && value.fixedShippingCents === null) context.addIssue({ code: "custom", path: ["fixedShippingCents"], message: "Configure a tarifa fixa antes de ativá-la." });
  if (value.freeShippingEnabled && value.freeShippingThresholdCents === null) context.addIssue({ code: "custom", path: ["freeShippingThresholdCents"], message: "Configure o limite antes de ativar o frete grátis." });
  if ((value.estimatedMinDays === null) !== (value.estimatedMaxDays === null)) context.addIssue({ code: "custom", path: ["estimatedMaxDays"], message: "Informe os dois limites de prazo ou deixe ambos vazios." });
  if (value.estimatedMinDays !== null && value.estimatedMaxDays !== null && value.estimatedMaxDays < value.estimatedMinDays) context.addIssue({ code: "custom", path: ["estimatedMaxDays"], message: "O prazo máximo precisa ser igual ou maior que o mínimo." });
});

function snapshot(settings: {
  originPostalCode: string | null; fixedShippingCents: number | null; freeShippingThresholdCents: number | null;
  regionalShippingEnabled: boolean; curitibaMetroShippingCents: number; interiorParanaShippingCents: number; otherStatesShippingCents: number;
  fixedShippingEnabled: boolean; freeShippingEnabled: boolean; correiosShippingEnabled: boolean; estimatedMinDays: number | null; estimatedMaxDays: number | null;
}) {
  return {
    originPostalCode: settings.originPostalCode,
    regionalShippingEnabled: settings.regionalShippingEnabled,
    curitibaMetroShippingCents: settings.curitibaMetroShippingCents,
    interiorParanaShippingCents: settings.interiorParanaShippingCents,
    otherStatesShippingCents: settings.otherStatesShippingCents,
    fixedShippingEnabled: settings.fixedShippingEnabled,
    fixedShippingCents: settings.fixedShippingCents,
    freeShippingEnabled: settings.freeShippingEnabled,
    freeShippingThresholdCents: settings.freeShippingThresholdCents,
    correiosShippingEnabled: settings.correiosShippingEnabled,
    estimatedMinDays: settings.estimatedMinDays,
    estimatedMaxDays: settings.estimatedMaxDays,
  };
}

export async function GET(request: Request) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  try {
    const settings = await getStoreShippingSettings();
    const history = settings.settingsTableAvailable
      ? await getDb().shippingSettingsHistory.findMany({ where: { settingsId: "store" }, orderBy: { createdAt: "desc" }, take: 30 })
      : [];
    return Response.json({ settings, history, correiosAvailable: hasCorreiosSettings(), requiresMigration: !settings.settingsTableAvailable });
  } catch {
    return Response.json({ message: "Não foi possível carregar as regras de frete." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ message: "Confira tarifas, modalidades e prazos informados." }, { status: 400 });
  if (parsed.data.correiosShippingEnabled && !hasCorreiosSettings()) return Response.json({ message: "Preencha e valide as credenciais e o contrato dos Correios antes de ativar essa modalidade." }, { status: 409 });

  const admin = await getCurrentUser();
  const adminId = admin?.id;
  const adminEmail = admin?.email;
  if (!adminId || !adminEmail) return Response.json({ message: "Sessão administrativa inválida." }, { status: 401 });
  const { data } = parsed;
  try {
    const result = await getDb().$transaction(async (tx) => {
      const previous = await tx.shippingSettings.findUnique({ where: { id: "store" } });
      const updated = await tx.shippingSettings.upsert({
        where: { id: "store" },
        create: { id: "store", ...data, updatedBy: adminId },
        update: { ...data, updatedBy: adminId },
      });
      await tx.shippingSettingsHistory.create({ data: {
        settingsId: "store",
        actorId: adminId,
        actorEmail: adminEmail,
        previousSettings: previous ? snapshot(previous) : {},
        currentSettings: snapshot(updated),
      } });
      return updated;
    }, { isolationLevel: "Serializable" });
    return Response.json({ settings: result, message: "Configurações de frete salvas e registradas no histórico." });
  } catch {
    return Response.json({ message: "As migrations de configuração regional precisam ser aplicadas e validadas em um Supabase de teste isolado." }, { status: 503 });
  }
}
