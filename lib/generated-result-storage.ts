import "server-only";

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const resultIdPattern = /^[A-Za-z0-9_-]{43}$/;
const generatedJpegPattern = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/;

function getPrivateBucket() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET;
  if (!url || !serviceRoleKey || !bucketName) {
    throw new Error("Private image storage is not configured.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).storage.from(bucketName);
}

export function hasPrivateStorageConfiguration(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_STORAGE_BUCKET);
}

export async function assertPrivateStorageAccess(): Promise<void> {
  const { error } = await getPrivateBucket().list("results", { limit: 1 });
  if (error) throw new Error("The private image bucket could not be accessed.", { cause: error });
}

function resultPath(resultId: string): string {
  if (!resultIdPattern.test(resultId)) throw new Error("The Lumora result ID is invalid.");
  return `results/${resultId}.jpg`;
}

export async function createFreePreview(originalBytes: Buffer): Promise<Buffer> {
  const originalImage = sharp(originalBytes);
  const dimensions = await originalImage.metadata();
  if (!dimensions.width || !dimensions.height) throw new Error("The generated image dimensions could not be read.");
  const previewEdge = Math.max(1, Math.min(1280, Math.floor(Math.max(dimensions.width, dimensions.height) * 0.75)));
  return originalImage
    .rotate()
    .resize({ width: previewEdge, height: previewEdge, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

export async function storeGeneratedResult(imageDataUrl: string): Promise<{ previewDataUrl: string; resultId: string }> {
  const match = generatedJpegPattern.exec(imageDataUrl);
  if (!match) throw new Error("The generated image is not a valid JPEG data URL.");

  const originalBytes = Buffer.from(match[1], "base64");
  if (originalBytes.toString("base64") !== match[1] || originalBytes.length < 3 || originalBytes[0] !== 0xff || originalBytes[1] !== 0xd8 || originalBytes[2] !== 0xff) {
    throw new Error("The generated image is not a valid JPEG.");
  }

  const previewBytes = await createFreePreview(originalBytes);
  const resultId = randomBytes(32).toString("base64url");
  const { error } = await getPrivateBucket().upload(resultPath(resultId), originalBytes, {
    contentType: "image/jpeg",
    cacheControl: "0",
    upsert: false,
  });
  if (error) throw new Error("The generated image could not be saved to private storage.", { cause: error });

  return {
    previewDataUrl: `data:image/jpeg;base64,${previewBytes.toString("base64")}`,
    resultId,
  };
}

export async function privateResultExists(resultId: string): Promise<boolean> {
  const path = resultPath(resultId);
  const { data, error } = await getPrivateBucket().list("results", {
    limit: 1,
    search: path.slice("results/".length),
  });
  if (error) throw new Error("The private result could not be checked.", { cause: error });
  return data.some((object) => object.name === path.slice("results/".length));
}

export async function readPrivateResult(resultId: string): Promise<Blob> {
  const { data, error } = await getPrivateBucket().download(resultPath(resultId));
  if (error) throw new Error("The private result could not be retrieved.", { cause: error });
  return data;
}
