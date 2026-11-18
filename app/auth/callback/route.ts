import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeInternalRedirectPath } from "@/lib/supabase/redirect";

function getConfirmationErrorKey(error: unknown) {
  const details = error && typeof error === "object"
    ? `${"code" in error ? String(error.code) : ""} ${"message" in error ? String(error.message) : ""}`
    : String(error ?? "");
  const normalized = details.toLowerCase();

  if (/redirect.*(not allowed|allowlist)|url.*not allowed/.test(normalized)) return "confirmacao-url";
  if (/otp_expired|expired|has expired|invalid or has expired|already used/.test(normalized)) return "confirmacao-expirada";
  return "confirmacao-falhou";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeInternalRedirectPath(requestUrl.searchParams.get("next"));
  const providerError = [
    requestUrl.searchParams.get("error"),
    requestUrl.searchParams.get("error_code"),
    requestUrl.searchParams.get("error_description"),
  ].filter(Boolean).join(" ");

  if (providerError) {
    const status = getConfirmationErrorKey(providerError);
    return NextResponse.redirect(new URL(`/minha-conta?auth=${status}`, requestUrl.origin));
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, requestUrl.origin));
    const status = getConfirmationErrorKey(error);
    return NextResponse.redirect(new URL(`/minha-conta?auth=${status}`, requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/minha-conta?auth=confirmacao-falhou", requestUrl.origin));
}
