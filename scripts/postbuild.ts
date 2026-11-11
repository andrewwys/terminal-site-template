/**
 * Build step, run after `bun build`:
 *  - fills the built index.html's title, meta tags, title bar and tabs from site.config.json;
 *  - adds the Content-Security-Policy from staticwebapp.config.json as a <meta> tag, for hosts
 *    that can't send response headers (GitHub Pages);
 *  - copies the images that content uses (e.g. project images) into dist/ under hashed names;
 *  - writes version.json with the commit it was built from, so the Studio can tell when a save is live.
 * Usage: bun scripts/postbuild.ts dist
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadContent } from "./lib/content";
import { ROOT } from "./lib/config";
import { applyCspMeta, applyPageMeta } from "./lib/html-meta";

const dist = process.argv[2];
if (!dist) throw new Error("usage: bun scripts/postbuild.ts <dist dir>");

const { content, assets } = loadContent();
const index = join(dist, "index.html");
const swa = (await Bun.file(join(ROOT, "staticwebapp.config.json")).json()) as { globalHeaders?: Record<string, string> };
const csp = swa.globalHeaders?.["content-security-policy"];
if (!csp) throw new Error("staticwebapp.config.json has no content-security-policy in globalHeaders");
await Bun.write(index, await applyCspMeta(await applyPageMeta(await Bun.file(index).text(), content), csp));
for (const a of assets) {
  mkdirSync(dirname(join(dist, a.url)), { recursive: true });
  copyFileSync(a.file, join(dist, a.url));
}
const commit = process.env.GITHUB_SHA || Bun.spawnSync(["git", "rev-parse", "HEAD"]).stdout.toString().trim() || null;
await Bun.write(join(dist, "version.json"), JSON.stringify({ commit, builtAt: new Date().toISOString() }) + "\n");
console.log(`  ${index}: title, meta tags, tabs and CSP set · ${assets.length} content image(s) copied`);
