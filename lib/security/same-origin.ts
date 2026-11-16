const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isDevelopmentLoopbackAlias(left: URL, right: URL) {
  if (process.env.NODE_ENV === "production" || left.protocol !== "http:" || right.protocol !== "http:") return false;

  const leftHost = left.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const rightHost = right.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const leftPort = left.port || "80";
  const rightPort = right.port || "80";

  return LOOPBACK_HOSTS.has(leftHost) && LOOPBACK_HOSTS.has(rightHost) && leftPort === rightPort;
}

export function isSameOriginMutationRequest(request: Pick<Request, "method" | "headers" | "url">) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const suppliedOrigin = new URL(origin);
      const requestUrl = new URL(request.url);
      return suppliedOrigin.origin === requestUrl.origin || isDevelopmentLoopbackAlias(suppliedOrigin, requestUrl);
    } catch {
      return false;
    }
  }

  return request.headers.get("sec-fetch-site") !== "cross-site";
}
