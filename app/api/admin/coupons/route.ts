import { z } from "zod";
import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
const schema = z.object({
  code: z.string().trim().min(3).max(32).regex(/^[A-Z0-9-]+$/),
  discountBps: z.number().int().min(1).max(10000).optional(),
  discountCents: z.number().int().min(1).max(100_000_000).optional(),
  minimumSubtotalCents: z.number().int().positive().max(100_000_000).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
}).superRefine((value, context) => {
  if (Boolean(value.discountBps) === Boolean(value.discountCents)) context.addIssue({ code: "custom", message: "Informe desconto percentual ou valor fixo." });
  if (value.startsAt && value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) context.addIssue({ code: "custom", message: "A data final precisa ser posterior à inicial." });
});
export async function GET(request: Request) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  try { const coupons = await getDb().coupon.findMany({ orderBy: { createdAt: "desc" } }); return Response.json({ coupons }); }
  catch { return Response.json({ message: "A migration aditiva dos cupons ainda precisa ser aplicada ao banco." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({}))); if (!parsed.success) return Response.json({ message: parsed.error.issues[0]?.message ?? "Cupom inválido." }, { status: 400 });
  const { startsAt, endsAt, ...fields } = parsed.data;
  try {
    const coupon = await getDb().coupon.create({ data: { ...fields, startsAt: startsAt ? new Date(startsAt) : null, endsAt: endsAt ? new Date(endsAt) : null, active: false } });
    return Response.json({ coupon, message: "Cupom criado inativo." }, { status: 201 });
  } catch { return Response.json({ message: "Código de cupom já existente ou migration pendente." }, { status: 409 }); }
}
