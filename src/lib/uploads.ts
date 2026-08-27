import { mkdir, unlink, writeFile, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
const MAX_BYTES = 15 * 1024 * 1024;

export async function storeUpload(file: File) {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) {
    throw new Error("Dosya gerekli.");
  }
  if (file.size > MAX_BYTES) throw new Error("Dosya 15 MB'ı aşamaz.");
  const ext = path.extname(file.name || "").replace(/[^\w.]/g, "").slice(0, 8);
  const storedName = `${randomUUID()}${ext}`;
  await mkdir(UPLOAD_ROOT, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_ROOT, storedName), buf);
  return {
    fileName: (file.name || "dosya").slice(0, 180),
    storedName,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
}

export function resolveStored(storedName: string) {
  if (!/^[\w.-]+$/.test(storedName)) throw new Error("Geçersiz dosya.");
  return path.join(UPLOAD_ROOT, storedName);
}

export async function readStored(storedName: string) {
  return readFile(resolveStored(storedName));
}

export async function removeUpload(storedName: string | null | undefined) {
  if (!storedName) return;
  try {
    await unlink(resolveStored(storedName));
  } catch {
    /* missing file is fine */
  }
}
