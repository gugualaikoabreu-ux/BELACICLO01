import { getDb } from "@/lib/db";
export async function CampaignBar() {
  let message = "Moda feminina e infantil · BelaCiclo";
  if (process.env.DATABASE_URL) {
    try {
      const now = new Date();
      const campaign = await getDb().campaign.findFirst({ where: { active: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] }, orderBy: { updatedAt: "desc" } });
      if (campaign) message = campaign.message;
    } catch { /* Store shell stays available while the database is being prepared. */ }
  }
  return <div className="announcement">{message}</div>;
}
