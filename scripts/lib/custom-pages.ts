import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CustomPage, SiteConfig } from "../../src/data/types";
import { renderMarkdown, splitFrontMatter } from "./markdown";
import { CONTENT_ROOT } from "./projects";

export const PAGES_DIR = join(CONTENT_ROOT, "pages");

const KNOWN = ["title", "command", "description"];

/** One custom page from content/pages/<id>.md. Throws on a missing title or an unknown field. */
export function parseCustomPage(source: string, id: string): CustomPage {
  const { meta, body } = splitFrontMatter(source);
  const fail = (msg: string): never => {
    throw new Error(`pages/${id}.md: ${msg}`);
  };
  for (const k of Object.keys(meta)) if (!KNOWN.includes(k)) fail(`unknown field "${k}" (known: ${KNOWN.join(", ")})`);
  const title = String(meta.title ?? "").trim() || fail("missing title");
  const text = (k: "command" | "description") => (typeof meta[k] === "string" && meta[k].trim() ? meta[k].trim() : undefined);
  return { id, title, command: text("command"), description: text("description"), html: renderMarkdown(body.trim()) };
}

/** The custom page for each `markdown` entry in the config. A listed page without a file fails the build. */
export function loadCustomPages(config: SiteConfig, dir = PAGES_DIR): CustomPage[] {
  return config.pages
    .filter((p) => p.type === "markdown")
    .map((p) => {
      const file = join(dir, `${p.id}.md`);
      if (!existsSync(file)) throw new Error(`site.config.json: pages lists "${p.id}" (markdown), but content/pages/${p.id}.md doesn't exist`);
      return parseCustomPage(readFileSync(file, "utf8"), p.id);
    });
}
