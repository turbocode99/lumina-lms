import "server-only";

import { unzipSync } from "fflate";

import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { parseManifest, ManifestError, type ScormManifest } from "./manifest";

/**
 * Imports a SCORM package: unzip it, read the manifest, write the files out.
 *
 * The whole archive is decompressed in memory. SCORM packages are typically a
 * few megabytes to a few tens of megabytes — a Storyline course with video is
 * the large end — and the upload cap already bounds it, so streaming would buy
 * complexity rather than headroom.
 */

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

export interface ImportResult {
  packageId: string;
  manifest: ScormManifest;
  fileCount: number;
  sizeBytes: number;
}

/**
 * A zip entry may name any path it likes, including `../../etc/passwd`. This
 * rejects anything that is absolute, escapes the package root, or carries a
 * Windows drive or UNC prefix — the "zip slip" class of bug, and the reason an
 * archive from an unknown author is never extracted by path alone.
 *
 * The storage driver refuses traversal again when it resolves the key, so this
 * is the outer of two independent checks rather than the only one.
 */
function safeEntryPath(raw: string): string | null {
  const name = raw.replace(/\\/g, "/");

  if (!name || name.endsWith("/")) return null;          // directory entry
  if (name.startsWith("/")) return null;                  // absolute
  if (/^[a-zA-Z]:/.test(name)) return null;               // C:\...
  if (name.startsWith("//")) return null;                 // UNC
  if (name.includes("\0")) return null;

  const parts: string[] = [];
  for (const segment of name.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") return null;                    // escapes the root
    parts.push(segment);
  }
  if (!parts.length) return null;

  return parts.join("/");
}

/** Extension-driven, because a zip carries no content types of its own. */
const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  mp4: "video/mp4",
  webm: "video/webm",
  m4v: "video/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  eot: "application/vnd.ms-fontobject",
  pdf: "application/pdf",
  swf: "application/x-shockwave-flash",
};

export function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? "application/octet-stream";
}

/** Some tools nest everything under a single top-level folder. */
function commonPrefix(paths: string[]): string {
  if (paths.length < 2) return "";
  const first = paths[0].split("/");
  if (first.length < 2) return "";
  const candidate = first[0] + "/";
  return paths.every((p) => p.startsWith(candidate)) ? candidate : "";
}

export async function importScormPackage(
  file: File,
  uploadedById: string
): Promise<ImportResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new ImportError("That file is not a readable ZIP archive.");
  }

  const names = Object.keys(entries);
  if (!names.length) throw new ImportError("The archive is empty.");

  // A manifest anywhere but the root means the package was zipped with its
  // folder included, which is common and harmless once the prefix is stripped.
  const prefix = commonPrefix(names.filter((n) => !n.endsWith("/")));
  const manifestName = names.find(
    (n) => n.replace(/\\/g, "/").toLowerCase() === `${prefix}imsmanifest.xml`.toLowerCase()
  );
  if (!manifestName) {
    throw new ImportError(
      "No imsmanifest.xml at the root of the archive. That file is what makes a ZIP a SCORM package."
    );
  }

  let manifest: ScormManifest;
  try {
    manifest = parseManifest(new TextDecoder().decode(entries[manifestName]));
  } catch (error) {
    if (error instanceof ManifestError) throw new ImportError(error.message);
    throw error;
  }

  const pkg = await db.scormPackage.create({
    data: {
      version: manifest.version,
      title: manifest.title,
      launchHref: manifest.launchHref,
      storageKey: "",
      manifestId: manifest.manifestId,
      uploadedById,
    },
    select: { id: true },
  });

  const storageKey = `scorm/${pkg.id}`;
  let fileCount = 0;
  let sizeBytes = 0;
  let launchFound = false;

  for (const [rawName, data] of Object.entries(entries)) {
    const stripped = prefix && rawName.startsWith(prefix) ? rawName.slice(prefix.length) : rawName;
    const rel = safeEntryPath(stripped);
    if (!rel) continue;   // directory entry, or a path trying to escape

    if (rel.toLowerCase() === manifest.launchHref.toLowerCase()) launchFound = true;

    await storage.putAt(`${storageKey}/${rel}`, data, contentTypeFor(rel));
    fileCount += 1;
    sizeBytes += data.byteLength;
  }

  /** A rejected import must take its extracted files with it. */
  const abandon = async (message: string): Promise<never> => {
    await storage.deletePrefix(storageKey).catch(() => {});
    await db.scormPackage.delete({ where: { id: pkg.id } }).catch(() => {});
    throw new ImportError(message);
  };

  if (!fileCount) await abandon("The archive contained no usable files.");

  // A manifest pointing at a file the archive does not contain is a broken
  // package, and it is much cheaper to say so now than to let a learner open a
  // blank frame later.
  if (!launchFound) {
    await abandon(
      `The manifest launches "${manifest.launchHref}", which is not in the archive.`
    );
  }

  await db.scormPackage.update({
    where: { id: pkg.id },
    data: { storageKey, fileCount, sizeBytes },
  });

  return { packageId: pkg.id, manifest, fileCount, sizeBytes };
}
