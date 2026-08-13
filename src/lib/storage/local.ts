import "server-only";

import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { nanoid } from "nanoid";

import type { ReadableObject, StorageDriver, StoredObject } from "./types";

/**
 * Local-disk driver — the default. Files land under STORAGE_LOCAL_DIR, which is
 * gitignored and should be a mounted volume in Docker so uploads survive
 * container restarts.
 */

const ROOT = path.resolve(
  process.cwd(),
  process.env.STORAGE_LOCAL_DIR || "./storage"
);

const EXTENSION_BY_TYPE: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
  "application/zip": ".zip",
};

/**
 * Keys are generated server-side, but `get`/`delete` receive them back from the
 * client, so every path is re-validated before it touches the filesystem.
 * Rejects traversal (`..`), absolute paths, and anything outside ROOT.
 */
function resolveKey(key: string): string | null {
  if (!key || key.includes("\0")) return null;
  const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  if (path.isAbsolute(normalized)) return null;
  const full = path.resolve(ROOT, normalized);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (!full.startsWith(rootWithSep)) return null;
  return full;
}

function extensionFor(originalName: string, contentType: string): string {
  const fromName = path.extname(originalName);
  if (fromName && /^\.[A-Za-z0-9]{1,5}$/.test(fromName)) return fromName.toLowerCase();
  return EXTENSION_BY_TYPE[contentType] ?? "";
}

export class LocalStorageDriver implements StorageDriver {
  readonly name = "local";

  async put(
    file: File | Blob,
    options: { folder: string; originalName: string }
  ): Promise<StoredObject> {
    const contentType = file.type || "application/octet-stream";
    // Folder comes from our own call sites, but normalise it anyway.
    const folder = options.folder.replace(/[^a-z0-9/_-]/gi, "") || "misc";
    const ext = extensionFor(options.originalName, contentType);
    const key = `${folder}/${nanoid(21)}${ext}`;

    const target = resolveKey(key);
    if (!target) throw new Error("Invalid storage key.");

    await fs.mkdir(path.dirname(target), { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(target, buffer);

    return {
      key,
      url: this.url(key),
      size: buffer.byteLength,
      contentType,
      originalName: options.originalName,
    };
  }

  async get(
    key: string,
    range?: { start: number; end?: number }
  ): Promise<ReadableObject | null> {
    const target = resolveKey(key);
    if (!target) return null;

    let stat;
    try {
      stat = await fs.stat(target);
    } catch {
      return null;
    }
    if (!stat.isFile()) return null;

    const total = stat.size;
    const contentType = contentTypeFor(target);

    if (range) {
      const start = Math.min(Math.max(0, range.start), Math.max(0, total - 1));
      const end = Math.min(range.end ?? total - 1, total - 1);
      const nodeStream = createReadStream(target, { start, end });
      return {
        stream: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
        size: end - start + 1,
        contentType,
        range: { start, end, total },
      };
    }

    const nodeStream = createReadStream(target);
    return {
      stream: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
      size: total,
      contentType,
    };
  }

  async delete(key: string): Promise<void> {
    const target = resolveKey(key);
    if (!target) return;
    await fs.rm(target, { force: true });
  }

  async exists(key: string): Promise<boolean> {
    const target = resolveKey(key);
    if (!target) return false;
    try {
      const stat = await fs.stat(target);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  url(key: string): string {
    return `/api/media/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
}

const TYPE_BY_EXTENSION: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
};

function contentTypeFor(filePath: string): string {
  return TYPE_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
