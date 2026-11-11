/**
 * Bun macro: runs when the site is bundled (dev server or `bun run build`). It reads and checks
 * site.config.json and the Markdown in content/ (posts, projects, pages) and inlines them into the
 * bundle as plain data, so the deployed site stays fully static. Any problem fails the build.
 */
import type { SiteContent } from "../src/data/types";
import { loadContent } from "./lib/content";

export function siteContent(): SiteContent {
  try {
    return loadContent().content;
  } catch (err) {
    // Bun reports a macro's exception without its message, so print the problems first.
    console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
    throw err;
  }
}
