import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEFAULT_STORE_ADMIN_EMAIL } from "@/lib/admin-identity";
import { isSameOriginMutationRequest } from "@/lib/security/same-origin";

async function hasAdminAccess() {
  if (!process.env.DATABASE_URL || !isSupabaseConfigured) return false;
  try {
    const user = await getCurrentUser();
    if (!user?.id || !user.email || !user.email_confirmed_at) return false;

    const allowlistedEmail = (process.env.STORE_ADMIN_EMAIL || DEFAULT_STORE_ADMIN_EMAIL).trim().toLowerCase();
    const db = getDb();
    if (user.email.trim().toLowerCase() === allowlistedEmail) {
      await db.adminUser.upsert({
        where: { authUserId: user.id },
        create: { authUserId: user.id, role: "OWNER" },
        update: { role: "OWNER" },
      });
      return true;
    }

    const membership = await db.adminUser.findUnique({ where: { authUserId: user.id }, select: { role: true } });
    return membership?.role === "OWNER" || membership?.role === "ADMIN";
  } catch {
    return false;
  }
}

export async function isAdmin() {
  return hasAdminAccess();
}

export async function isAdminRequest(request: Request) {
  if (!isSameOriginMutationRequest(request)) return false;
  return hasAdminAccess();
}
