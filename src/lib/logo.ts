import { UserError } from "./actions";

const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 500 * 1024;

/** Lit le logo envoyé : PNG, JPEG ou WebP, 500 Ko maximum (connexion faible oblige). */
export async function readLogo(formData: FormData, key = "logo"): Promise<{ data: Buffer; mime: string } | null> {
  const file = formData.get(key);
  if (!(file instanceof File) || file.size === 0) return null;
  if (!ALLOWED.includes(file.type)) throw new UserError("Le logo doit être une image PNG, JPEG ou WebP.");
  if (file.size > MAX_BYTES) throw new UserError("Le logo est trop lourd (500 Ko maximum).");
  return { data: Buffer.from(await file.arrayBuffer()), mime: file.type };
}
