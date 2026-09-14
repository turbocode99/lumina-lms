import "server-only";

import { parseXml, type XmlElement, type XmlDocument } from "@rgrove/parse-xml";

/**
 * Reads `imsmanifest.xml`, which is the only part of a SCORM package that is
 * genuinely standardised.
 *
 * The two versions differ less than their specs suggest, at least for launching.
 * Both describe organizations of items, and both point an item at a resource
 * whose `href` is the file to open. What changes is the declared schema version
 * and, at runtime, the name of the JavaScript object the content looks for.
 *
 * Namespaces are ignored throughout. Packages in the wild bind adlcp, imscp and
 * the rest to whatever prefix their authoring tool felt like, and matching on
 * local names is both simpler and more tolerant of that than trying to resolve
 * prefixes properly.
 */

export type ScormVersion = "1.2" | "2004";

export interface ScormManifest {
  version: ScormVersion;
  /** Title from the default organization, falling back to the manifest id. */
  title: string;
  /** Package-relative path to open, e.g. "index_lms.html" or "shared/launch.html". */
  launchHref: string;
  manifestId: string | null;
  /** How many launchable items the default organization declares. */
  scoCount: number;
}

export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestError";
  }
}

function localName(node: XmlElement): string {
  const name = node.name;
  const colon = name.indexOf(":");
  return (colon === -1 ? name : name.slice(colon + 1)).toLowerCase();
}

function elements(node: XmlElement | XmlDocument): XmlElement[] {
  return node.children.filter(
    (c): c is XmlElement => (c as XmlElement).type === "element"
  );
}

function childrenNamed(node: XmlElement | XmlDocument, name: string): XmlElement[] {
  return elements(node).filter((c) => localName(c) === name);
}

function firstNamed(node: XmlElement | XmlDocument, name: string): XmlElement | null {
  return childrenNamed(node, name)[0] ?? null;
}

/** Attribute lookup that ignores any namespace prefix on the attribute itself. */
function attr(node: XmlElement, name: string): string | null {
  const direct = node.attributes[name];
  if (direct !== undefined) return direct;
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(node.attributes)) {
    const colon = key.indexOf(":");
    const local = colon === -1 ? key : key.slice(colon + 1);
    if (local.toLowerCase() === lower) return value;
  }
  return null;
}

function textOf(node: XmlElement | null): string {
  if (!node) return "";
  return node.children
    .map((c) => ("text" in c ? String(c.text) : ""))
    .join("")
    .trim();
}

/**
 * `<schemaversion>` is free text and authoring tools are inventive with it:
 * "1.2", "CAM 1.3", "2004 3rd Edition", "2004 4th Edition" all appear. Anything
 * that is not recognisably 1.2 is treated as 2004, which is the safer default —
 * a 2004 package handed the 1.2 API fails immediately, while the reverse mostly
 * works because the 1.2 data model is a subset.
 */
function detectVersion(schemaVersion: string): ScormVersion {
  const v = schemaVersion.toLowerCase();
  if (v.includes("1.2")) return "1.2";
  if (v.includes("2004") || v.includes("cam 1.3") || v.includes("1.3")) return "2004";
  return "2004";
}

/** Resolves an href against an optional xml:base, the way the spec requires. */
function joinHref(base: string | null, href: string): string {
  const clean = (s: string) => s.replace(/^\.?\//, "").replace(/\\/g, "/");
  if (!base) return clean(href);
  const b = clean(base).replace(/\/?$/, "/");
  return clean(b + clean(href));
}

export function parseManifest(xml: string): ScormManifest {
  let doc: XmlDocument;
  try {
    doc = parseXml(xml, { ignoreUndefinedEntities: true });
  } catch (error) {
    throw new ManifestError(
      `imsmanifest.xml is not valid XML: ${error instanceof Error ? error.message : "unknown"}`
    );
  }

  const manifest = childrenNamed(doc, "manifest")[0];
  if (!manifest) throw new ManifestError("imsmanifest.xml has no <manifest> element.");

  const manifestId = attr(manifest, "identifier");
  const manifestBase = attr(manifest, "base");

  const metadata = firstNamed(manifest, "metadata");
  const schemaVersion = textOf(metadata ? firstNamed(metadata, "schemaversion") : null);
  const version = detectVersion(schemaVersion);

  // --- Resources, indexed by identifier -----------------------------------
  const resourcesEl = firstNamed(manifest, "resources");
  const resourceBase = resourcesEl ? attr(resourcesEl, "base") : null;
  const resources = new Map<string, { href: string | null; scormType: string }>();

  if (resourcesEl) {
    for (const res of childrenNamed(resourcesEl, "resource")) {
      const id = attr(res, "identifier");
      if (!id) continue;
      const href = attr(res, "href");
      resources.set(id, {
        href: href ? joinHref(joinHref(manifestBase, resourceBase ?? ""), href) : null,
        // adlcp:scormtype distinguishes a launchable SCO from a plain asset.
        scormType: (attr(res, "scormtype") ?? "").toLowerCase(),
      });
    }
  }

  // --- Default organization -----------------------------------------------
  const orgsEl = firstNamed(manifest, "organizations");
  const orgs = orgsEl ? childrenNamed(orgsEl, "organization") : [];
  const defaultId = orgsEl ? attr(orgsEl, "default") : null;
  const org =
    orgs.find((o) => attr(o, "identifier") === defaultId) ?? orgs[0] ?? null;

  const title = textOf(org ? firstNamed(org, "title") : null) || manifestId || "Imported course";

  /** Items nest arbitrarily deep; the launchable ones carry identifierref. */
  const launchable: string[] = [];
  const walk = (node: XmlElement) => {
    for (const item of childrenNamed(node, "item")) {
      const ref = attr(item, "identifierref");
      if (ref) {
        const resource = resources.get(ref);
        if (resource?.href) launchable.push(resource.href);
      }
      walk(item);
    }
  };
  if (org) walk(org);

  // Falling back to the first resource that looks like a SCO, then to any
  // resource with an href, covers packages whose organization is empty — which
  // is malformed but common enough to be worth surviving.
  const fallback =
    [...resources.values()].find((r) => r.scormType === "sco" && r.href)?.href ??
    [...resources.values()].find((r) => r.href)?.href ??
    null;

  const launchHref = launchable[0] ?? fallback;
  if (!launchHref) {
    throw new ManifestError(
      "No launchable resource found. The manifest declares no resource with an href."
    );
  }

  return {
    version,
    title,
    launchHref,
    manifestId,
    scoCount: launchable.length,
  };
}
