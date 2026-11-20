import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
  if (!globalForPrisma.prisma) {
    // Vercel creates multiple short-lived Node runtimes. Keep each runtime's
    // Supabase pool small so concurrent cold starts do not consume all DB
    // connections; a single client connection is enough for each instance.
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: true,
      keepAlive: true,
    });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}
