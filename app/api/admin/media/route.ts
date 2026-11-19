import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isAdminRequest } from "@/lib/admin";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
import { isSafeHttpsBaseUrl } from "@/lib/media/urls";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const imageTypes = new Map([
  ["image/jpeg", { extension: "jpg", signature: (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ["image/png", { extension: "png", signature: (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) }],
  ["image/webp", { extension: "webp", signature: (bytes: Buffer) => bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" }],
  ["image/avif", { extension: "avif", signature: (bytes: Buffer) => bytes.toString("ascii", 4, 12).includes("avif") }]
]);

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

export async function POST(request: Request) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8 * 1024 * 1024 + 64 * 1024) return Response.json({ message: "A imagem deve ter até 8 MB." }, { status: 413 });
  const mediaBucketUrl = process.env.MEDIA_BUCKET_URL;
  const mediaPublicBaseUrl = process.env.MEDIA_PUBLIC_BASE_URL;
  const mediaAccessKey = process.env.MEDIA_ACCESS_KEY;
  const mediaSecretKey = process.env.MEDIA_SECRET_KEY;
  const s3StorageConfigured = Boolean(mediaBucketUrl && mediaPublicBaseUrl && mediaAccessKey && mediaSecretKey);
  const supabaseStorageConfigured = Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  const useSupabaseStorage = !s3StorageConfigured && supabaseStorageConfigured;
  const useLocalDevelopmentStorage = process.env.NODE_ENV === "development" && !s3StorageConfigured && !supabaseStorageConfigured;
  if (!s3StorageConfigured && !supabaseStorageConfigured && !useLocalDevelopmentStorage) {
    return Response.json({ message: "Configure o armazenamento de imagens da loja antes de enviar fotos." }, { status: 503 });
  }

  try {
    if (!await enforceRateLimit("admin-media", requestIp(request), 30, 60)) return Response.json({ message: "Limite de envios excedido. Aguarde um minuto." }, { status: 429 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ message: "Selecione uma imagem para enviar." }, { status: 400 });
    if (file.size < 1 || file.size > 8 * 1024 * 1024) return Response.json({ message: "A imagem deve ter até 8 MB." }, { status: 400 });

    const type = imageTypes.get(file.type);
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!type || !type.signature(bytes)) return Response.json({ message: "Formato inválido. Use JPEG, PNG, WebP ou AVIF." }, { status: 400 });

    if (useLocalDevelopmentStorage) {
      const filename = `${randomUUID()}.${type.extension}`;
      const directory = join(process.cwd(), "public", "products");
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, filename), bytes, { flag: "wx" });
      return Response.json({ url: `/products/${filename}` }, { status: 201 });
    }

    if (useSupabaseStorage) {
      const bucketName = "product-images";
      const storage = createSupabaseAdminClient().storage;
      const bucket = await storage.getBucket(bucketName);
      if (bucket.error) {
        const statusCode = "statusCode" in bucket.error ? String(bucket.error.statusCode) : "";
        const isMissing = statusCode === "404" || /bucket not found/i.test(bucket.error.message);
        if (!isMissing) return Response.json({ message: "Não foi possível acessar o armazenamento de fotos." }, { status: 503 });
        const created = await storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 8 * 1024 * 1024,
          allowedMimeTypes: [...imageTypes.keys()],
        });
        if (created.error && !/already exists/i.test(created.error.message)) {
          return Response.json({ message: "Não foi possível preparar o armazenamento de fotos." }, { status: 503 });
        }
      }

      const key = `products/${randomUUID()}.${type.extension}`;
      const upload = await storage.from(bucketName).upload(key, bytes, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });
      if (upload.error) return Response.json({ message: "O armazenamento não aceitou a foto. Tente enviar novamente." }, { status: 502 });
      const { data } = storage.from(bucketName).getPublicUrl(key);
      return Response.json({ url: data.publicUrl, key }, { status: 201 });
    }

    const bucketUrl = new URL(mediaBucketUrl!);
    if (!isSafeHttpsBaseUrl(mediaBucketUrl!) || !isSafeHttpsBaseUrl(mediaPublicBaseUrl!)) {
      return Response.json({ message: "As URLs do armazenamento precisam usar HTTPS e não podem incluir parâmetros." }, { status: 503 });
    }

    const key = `products/${randomUUID()}.${type.extension}`;
    const basePath = bucketUrl.pathname.replace(/\/+$/, "");
    const objectPath = key.split("/").map(encodeURIComponent).join("/");
    const url = new URL(`${basePath}/${objectPath}`, bucketUrl.origin);
    const payloadHash = createHash("sha256").update(bytes).digest("hex");
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const region = process.env.MEDIA_REGION || "auto";
    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
    const canonicalHeaders = `content-type:${file.type}\nhost:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const canonicalRequest = ["PUT", url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${mediaSecretKey!}`, dateStamp), region), "s3"), "aws4_request");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${mediaAccessKey!}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const upload = await fetch(url, { method: "PUT", headers: { authorization, "content-type": file.type, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate }, body: bytes, cache: "no-store" });
    if (!upload.ok) return Response.json({ message: "O armazenamento não aceitou a imagem. Confira as credenciais e permissões do bucket." }, { status: 502 });

    const publicBase = mediaPublicBaseUrl!.replace(/\/+$/, "");
    return Response.json({ url: `${publicBase}/${key}`, key }, { status: 201 });
  } catch {
    return Response.json({ message: "Não foi possível enviar a imagem." }, { status: 502 });
  }
}
