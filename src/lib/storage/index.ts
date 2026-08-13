import "server-only";

import { LocalStorageDriver } from "./local";
import type { StorageDriver } from "./types";

export type { StorageDriver, StoredObject, ReadableObject } from "./types";

/**
 * Driver registry. Add an entry here after implementing the StorageDriver
 * interface, then flip STORAGE_DRIVER in .env — no other change required.
 *
 *   s3:    new S3StorageDriver({ bucket: process.env.S3_BUCKET! })
 *   azure: new AzureBlobDriver({ container: process.env.AZURE_CONTAINER! })
 */
function createDriver(): StorageDriver {
  const name = (process.env.STORAGE_DRIVER || "local").toLowerCase();
  switch (name) {
    case "local":
      return new LocalStorageDriver();
    default:
      console.warn(
        `[storage] Unknown STORAGE_DRIVER "${name}", falling back to "local".`
      );
      return new LocalStorageDriver();
  }
}

const globalForStorage = globalThis as unknown as {
  luminaStorage: StorageDriver | undefined;
};

export const storage: StorageDriver =
  globalForStorage.luminaStorage ?? createDriver();

if (process.env.NODE_ENV !== "production") {
  globalForStorage.luminaStorage = storage;
}

export function maxUploadBytes(): number {
  const mb = Number(process.env.STORAGE_MAX_UPLOAD_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : 512) * 1024 * 1024;
}

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export const ALLOWED_RESOURCE_TYPES = [
  "application/pdf",
  "application/zip",
  ...ALLOWED_IMAGE_TYPES,
];

/** Extracts the storage key back out of a `/api/media/<key>` URL. */
export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^\/api\/media\/(.+)$/);
  if (!match) return null;
  return match[1]
    .split("/")
    .map((part) => decodeURIComponent(part))
    .join("/");
}
