import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import sharp from "sharp";
import { ServiceError } from "./errors";

/**
 * Dateispeicher für Profilfotos.
 *
 *  - Testmodus: data/uploads/ auf der Festplatte
 *  - Supabase: privater Bucket „media“
 *
 * Dateien sind nie direkt öffentlich. Ausgeliefert wird über
 * /api/media/avatar/[driverId], das die Sichtbarkeit prüft.
 */

export type StoredFile = { bytes: Uint8Array; contentType: string };

interface FileStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  remove(key: string): Promise<void>;
}

const LOCAL_ROOT = join(process.cwd(), "data", "uploads");
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "media";

function safeLocalPath(key: string): string {
  const path = normalize(join(LOCAL_ROOT, key));
  // Kein Ausbrechen aus dem Upload-Verzeichnis über "../".
  if (!path.startsWith(LOCAL_ROOT + sep)) throw new Error("Ungültiger Dateischlüssel");
  return path;
}

const localStorage: FileStorage = {
  async put(key, bytes, contentType) {
    const path = safeLocalPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    await writeFile(`${path}.type`, contentType);
  },
  async get(key) {
    try {
      const path = safeLocalPath(key);
      const [bytes, contentType] = await Promise.all([readFile(path), readFile(`${path}.type`, "utf8")]);
      return { bytes: new Uint8Array(bytes), contentType };
    } catch {
      return null;
    }
  },
  async remove(key) {
    const path = safeLocalPath(key);
    await Promise.allSettled([unlink(path), unlink(`${path}.type`)]);
  },
};

async function supabaseStorage(): Promise<FileStorage> {
  const { supabaseClient } = await import("@/lib/db/supabase");
  const bucket = () => supabaseClient().storage.from(BUCKET);
  return {
    async put(key, bytes, contentType) {
      const { error } = await bucket().upload(key, bytes, { contentType, upsert: true });
      if (error) throw new Error(`Storage: ${error.message}`);
    },
    async get(key) {
      const { data, error } = await bucket().download(key);
      if (error || !data) return null;
      return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: data.type || "image/jpeg" };
    },
    async remove(key) {
      await bucket().remove([key]);
    },
  };
}

async function storage(): Promise<FileStorage> {
  return (process.env.LIEFERDANK_DB ?? "memory").toLowerCase() === "supabase"
    ? supabaseStorage()
    : localStorage;
}

export async function putFile(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  return (await storage()).put(key, bytes, contentType);
}

export async function getFile(key: string): Promise<StoredFile | null> {
  return (await storage()).get(key);
}

export async function removeFile(key: string): Promise<void> {
  return (await storage()).remove(key);
}

/* ---------- Bildprüfung ---------- */

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/**
 * Prüft anhand der Dateisignatur, nicht der Dateiendung oder des
 * mitgeschickten Content-Types – beides ist vom Client frei wählbar.
 */
export function detectImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function validatePhoto(bytes: Uint8Array): Promise<StoredFile> {
  if (bytes.length === 0) throw new ServiceError("photo_empty", "Die Datei ist leer.", 400, "photo");
  if (bytes.length > MAX_PHOTO_BYTES) {
    throw new ServiceError("photo_too_large", "Das Foto ist zu groß (max. 2 MB).", 400, "photo");
  }
  const type = detectImageType(bytes);
  if (!type) {
    throw new ServiceError("photo_type", "Bitte ein JPG-, PNG- oder WebP-Bild hochladen.", 400, "photo");
  }
  try {
    const format = type.slice(6) as "jpeg" | "png" | "webp";
    // Vollständig decodieren und ohne Metadaten neu schreiben: Header-Attrappen,
    // kaputte Dateien und EXIF-Ortsdaten gelangen so nicht in den Bucket.
    const normalized = await sharp(Buffer.from(bytes), { failOn: "error", limitInputPixels: 8_000_000 })
      .rotate()
      .toFormat(format)
      .toBuffer();
    if (normalized.length > MAX_PHOTO_BYTES) {
      throw new ServiceError("photo_too_large", "Das Foto ist nach der Verarbeitung zu groß (max. 2 MB).", 400, "photo");
    }
    return { bytes: new Uint8Array(normalized), contentType: type };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("photo_invalid", "Das Bild ist beschädigt oder zu groß. Bitte wähle ein anderes Foto.", 400, "photo");
  }
}
