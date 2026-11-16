import { z } from "zod";

const localProductImagePath = /^\/products\/[a-z0-9_-]+\.(?:jpe?g|png|webp|avif)$/i;

export const productImageUrlSchema = z.string().max(2048).refine((value) => {
  if (localProductImagePath.test(value)) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "Use uma URL HTTPS ou uma foto enviada à loja.");
