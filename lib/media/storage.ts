import { createHash, createHmac } from "node:crypto";
import { basename, join, resolve } from "node:path";
import { unlink } from "node:fs/promises";
import { isSafeHttpsBaseUrl } from "./urls.ts";

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function safeImageFilename(value: string) {
  const filename = basename(value);
  return /^[0-9a-f-]{36}\.(jpg|png|webp|avif)$/i.test(filename) ? filename : null;
}

function signedS3Headers(method: "PUT" | "DELETE", url: URL, contentType: string, payloadHash: string, now = new Date()) {
  const accessKey = process.env.MEDIA_ACCESS_KEY?.trim();
  const secretKey = process.env.MEDIA_SECRET_KEY?.trim();
  if (!accessKey || !secretKey) throw new Error("Armazenamento remoto não configurado.");
  const region = process.env.MEDIA_REGION?.trim() || "auto";
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const signedHeaders = method === "PUT" ? "content-type;host;x-amz-content-sha256;x-amz-date" : "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = method === "PUT"
    ? `content-type:${contentType}\nhost:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
    : `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const canonicalRequest = [method, url.pathname, url.searchParams.toString(), canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...(method === "PUT" ? { "content-type": contentType } : {}),
  };
}

export async function deleteManagedProductImage(imageUrl: string) {
  if (imageUrl.startsWith("/products/")) {
    const filename = safeImageFilename(imageUrl.slice("/products/".length));
    if (!filename) throw new Error("Caminho de imagem local inválido.");
    const directory = resolve(process.cwd(), "public", "products");
    const target = resolve(directory, filename);
    if (!target.startsWith(`${directory}/`) && !target.startsWith(`${directory}\\`)) throw new Error("Caminho de arquivo inválido.");
    try { await unlink(join(directory, filename)); }
    catch (error) {
      if (!(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT")) throw error;
    }
    return true;
  }

  const publicBase = process.env.MEDIA_PUBLIC_BASE_URL?.trim();
  if (!publicBase) return false;
  let publicUrl: URL; let storedUrl: URL;
  try { publicUrl = new URL(publicBase); storedUrl = new URL(imageUrl); }
  catch { return false; }
  const prefix = publicUrl.pathname.replace(/\/+$/, "");
  if (!isSafeHttpsBaseUrl(publicBase) || storedUrl.protocol !== "https:" || storedUrl.origin !== publicUrl.origin || !storedUrl.pathname.startsWith(`${prefix}/`)) return false;
  const encodedKey = storedUrl.pathname.slice(prefix.length + 1);
  const key = encodedKey.split("/").map((segment) => decodeURIComponent(segment)).join("/");
  if (!/^products\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/i.test(key) || key.split("/").some((segment) => segment === "." || segment === "..")) throw new Error("Chave de imagem remota inválida.");

  const bucketUrlRaw = process.env.MEDIA_BUCKET_URL?.trim();
  if (!bucketUrlRaw) throw new Error("URL do bucket de imagens não configurada.");
  const bucket = new URL(bucketUrlRaw);
  if (!isSafeHttpsBaseUrl(bucketUrlRaw)) throw new Error("URL segura do bucket não configurada.");
  const objectPath = key.split("/").map(encodeURIComponent).join("/");
  const url = new URL(`${bucket.pathname.replace(/\/+$/, "")}/${objectPath}`, bucket.origin);
  const emptyHash = createHash("sha256").update("").digest("hex");
  const headers = signedS3Headers("DELETE", url, "", emptyHash);
  const response = await fetch(url, { method: "DELETE", headers, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok && response.status !== 404) throw new Error("O armazenamento remoto não confirmou a remoção da imagem.");
  return true;
}
