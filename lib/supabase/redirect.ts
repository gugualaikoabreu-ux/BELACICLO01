const FALLBACK_PATH = "/minha-conta";
const INTERNAL_ORIGIN = "https://belaciclo.invalid";

export function safeInternalRedirectPath(candidate: string | null) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\") || /[\r\n]/.test(candidate)) {
    return FALLBACK_PATH;
  }

  try {
    const target = new URL(candidate, INTERNAL_ORIGIN);
    if (target.origin !== INTERNAL_ORIGIN) return FALLBACK_PATH;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return FALLBACK_PATH;
  }
}
