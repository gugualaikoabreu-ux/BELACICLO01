export const DEFAULT_STORE_ADMIN_EMAIL = "gustavo.alaiko@icloud.com";

export function isStoreAdminEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === DEFAULT_STORE_ADMIN_EMAIL;
}
