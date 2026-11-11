/**
 * Images referenced from content (e.g. a project's `image`). They're copied into the build under
 * a content-hashed name, so they can be cached for a year (see staticwebapp.config.json) and a
 * changed image always gets a new URL.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, relative, resolve, sep } from "node:path";

export const IMAGE_EXTENSIONS = [".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif"] as const;
export const MAX_IMAGE_BYTES = 1024 * 1024;
/** Where hashed content assets live, both in dist/ and on the dev server. */
export const ASSET_DIR = "assets/c";

export interface Asset {
  /** The source file on disk. */
  file: string;
  /** Its URL in the built site, relative to index.html, e.g. `assets/c/rich-world-1a2b3c4d.png`. */
  url: string;
}

/**
 * Resolves an image path written in a Markdown file, relative to that file, and checks it.
 * Throws a message naming the file and field on any problem.
 */
export function resolveImage(mdFile: string, rel: string, contentRoot: string, label: string): Asset {
  const where = `${relative(resolve(contentRoot, ".."), mdFile)}: ${label}`;
  if (/^[a-z][a-z0-9+.-]*:|^\//i.test(rel)) throw new Error(`${where} must be a path relative to the .md file, not a URL`);
  const file = resolve(dirname(mdFile), rel);
  if (!file.startsWith(resolve(contentRoot) + sep)) throw new Error(`${where} must stay inside content/`);
  const ext = extname(file).toLowerCase();
  if (!(IMAGE_EXTENSIONS as readonly string[]).includes(ext))
    throw new Error(`${where} must be one of ${IMAGE_EXTENSIONS.join(", ")} (found "${rel}")`);
  if (!existsSync(file)) throw new Error(`${where}: no file at ${rel}`);
  const size = statSync(file).size;
  if (size > MAX_IMAGE_BYTES)
    throw new Error(`${where}: ${rel} is ${Math.round(size / 1024)} KB; the limit is ${MAX_IMAGE_BYTES / 1024} KB`);
  const hash = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 8);
  const name = basename(file, extname(file)).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return { file, url: `${ASSET_DIR}/${name}-${hash}${ext}` };
}
