import type { CookieOptions } from "@supabase/ssr";

/** Keep browser and server auth cookies persistent with matching settings. */
export const supabaseCookieOptions: CookieOptions = {
  path: "/",
  sameSite: "lax",
  maxAge: 400 * 24 * 60 * 60,
  secure: process.env.NODE_ENV === "production",
};
