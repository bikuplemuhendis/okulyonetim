import { mkdir, unlink, writeFile, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_BYTES = 15 * 1024 * 1024;

function uploadPath(storedName: string) {
  return path.join(process.cwd(), "uploads", storedName);
}

export async function storeUpload(file: File) {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) {
    throw new Error("Dosya gerekli.");
  }
  if (file.size > MAX_BYTES) throw new Error("Dosya 15 MB'ı aşamaz.");
  const ext = path.extname(file.name || "").replace(/[^\w.]/g, "").slice(0, 8);
  const storedName = `${randomUUID()}${ext}`;
  await mkdir(path.join(process.cwd(), "uploads"), { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(uploadPath(storedName), buf);
  return {
    fileName: (file.name || "dosya").slice(0, 180),
    storedName,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
}

export function resolveStored(storedName: string) {
  if (!/^[\w.-]+$/.test(storedName)) throw new Error("Geçersiz dosya.");
  return uploadPath(storedName);
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
