const DEFAULT_AUTH_CALLBACK_URL = "https://belaciclo-loja.vercel.app/auth/callback";

export function getAuthCallbackUrl(next?: string) {
  const configured = process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL?.trim();
  let callbackUrl: URL;

  try {
    callbackUrl = new URL(configured || DEFAULT_AUTH_CALLBACK_URL);
    const isLocalhost = callbackUrl.hostname === "localhost" || callbackUrl.hostname === "127.0.0.1";
    if (callbackUrl.protocol !== "https:" && !(callbackUrl.protocol === "http:" && isLocalhost)) {
      callbackUrl = new URL(DEFAULT_AUTH_CALLBACK_URL);
    }
  } catch {
    callbackUrl = new URL(DEFAULT_AUTH_CALLBACK_URL);
  }

  if (next) callbackUrl.searchParams.set("next", next);
  return callbackUrl.toString();
}
