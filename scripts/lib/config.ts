import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { ConfigError, migrateConfig, REPO_PATTERN, validateConfig } from "../../src/data/config-rules";
import type { Profile, SiteConfig } from "../../src/data/types";

export { ConfigError, migrateConfig, SCHEMA_VERSION, validateConfig } from "../../src/data/config-rules";

export const ROOT = join(import.meta.dir, "../..");
export const CONFIG_FILE = join(ROOT, "site.config.json");

/** Largest photo the build will inline. The photo becomes a data: URL in the bundle. */
export const MAX_PHOTO_BYTES = 512 * 1024;

const PHOTO_TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/** Reads the photo file and returns it as a data: URL, so the bundle needs no separate asset. */
export function photoDataUrl(src: string, root = ROOT): string {
  const file = resolve(root, src);
  if (!file.startsWith(resolve(root) + sep)) throw new ConfigError([`profile.photo.src must stay inside the repo`]);
  if (!existsSync(file)) throw new ConfigError([`profile.photo.src: no file at ${src}`]);
  const size = statSync(file).size;
  if (size > MAX_PHOTO_BYTES)
    throw new ConfigError([`profile.photo.src: ${src} is ${Math.round(size / 1024)} KB; the limit is ${MAX_PHOTO_BYTES / 1024} KB (resize it to about 440×440)`]);
  const type = PHOTO_TYPES[extname(file).toLowerCase()]!;
  return `data:${type};base64,${readFileSync(file).toString("base64")}`;
}

/**
 * Loads site.config.json, upgrades and checks it, and inlines the photo. Throws ConfigError on any problem.
 * Without `site.repo`, a build on GitHub Actions uses the repository it runs in (`ciRepo`), so a
 * site made from the template opens its own repo in the Studio without any setup.
 */
export function loadConfig(file = CONFIG_FILE, root = ROOT, ciRepo = process.env.GITHUB_REPOSITORY): SiteConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new ConfigError([err instanceof SyntaxError ? `is not valid JSON: ${err.message}` : `can't be read: ${String(err)}`]);
  }
  const config = validateConfig(migrateConfig(parsed));
  const profile: Profile = { ...config.profile, photo: { ...config.profile.photo, src: photoDataUrl(config.profile.photo.src, root) } };
  const site = !config.site.repo && ciRepo && REPO_PATTERN.test(ciRepo) ? { ...config.site, repo: ciRepo } : config.site;
  return { ...config, site, profile };
}
