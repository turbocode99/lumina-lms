/**
 * Storage driver contract.
 *
 * Course media never touches component code directly — everything goes through
 * this interface. To move from local disk to S3, Azure Blob, or a video service
 * like Mux, implement these five methods in a new file and register it in
 * `src/lib/storage/index.ts`. No other file needs to change.
 */

export interface StoredObject {
  /** Opaque key used to retrieve the object later, e.g. "video/abc123.mp4". */
  key: string;
  /** URL the browser can load. For the local driver this is /api/media/<key>. */
  url: string;
  size: number;
  contentType: string;
  originalName: string;
}

export interface ReadableObject {
  stream: ReadableStream<Uint8Array>;
  size: number;
  contentType: string;
  /** Byte range actually served, for HTTP 206 responses. */
  range?: { start: number; end: number; total: number };
}

export interface StorageDriver {
  readonly name: string;

  /** Persists a file and returns its key plus a browser-loadable URL. */
  put(
    file: File | Blob,
    options: { folder: string; originalName: string }
  ): Promise<StoredObject>;

  /**
   * Writes bytes at an exact key, rather than generating one.
   *
   * `put` invents a key, which is right for a single upload and wrong for a
   * SCORM package, where the files reference each other by relative path and
   * have to keep the layout the author gave them.
   *
   * Implementations must reject keys that escape the storage root: these paths
   * come from inside a ZIP written by someone else.
   */
  putAt(key: string, data: Uint8Array, contentType: string): Promise<void>;

  /** Removes every object under a key prefix. Used when a package is replaced. */
  deletePrefix(prefix: string): Promise<void>;

  /**
   * Opens an object for reading. `range` supports HTTP range requests, which is
   * what makes video seeking work.
   */
  get(
    key: string,
    range?: { start: number; end?: number }
  ): Promise<ReadableObject | null>;

  delete(key: string): Promise<void>;

  exists(key: string): Promise<boolean>;

  /** Browser-loadable URL for a key. */
  url(key: string): string;
}
