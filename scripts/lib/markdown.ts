/** Front matter, Markdown and field helpers shared by every content collection (posts, projects, pages). */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** Splits `--- yaml --- body` into parsed front matter and the Markdown body. */
export function splitFrontMatter(source: string): { meta: Record<string, unknown>; body: string } {
  const m = source.match(FRONT);
  if (!m) throw new Error("no front matter (--- … ---) at the top");
  const meta = (Bun.YAML.parse(m[1]!) ?? {}) as Record<string, unknown>;
  return { meta, body: m[2]! };
}

export const isHttpUrl = (s: string): boolean => {
  try {
    return ["https:", "http:"].includes(new URL(s).protocol);
  } catch {
    return false;
  }
};

/** Links may point to http(s), mailto, the site's own hash routes or relative paths; anything else (javascript:, data:) becomes "#". */
export const safeHref = (href: string): string =>
  /^(https?:|mailto:|#|\/(?!\/)|\.{0,2}\/)/i.test(href) || !/^[a-z][a-z0-9+.-]*:/i.test(href) ? href : "#";

/** Markdown → HTML. Raw HTML is shown as text, not rendered, and unsafe link targets are dropped. */
export function renderMarkdown(md: string): string {
  const out = Bun.markdown.html(md, { noHtmlBlocks: true, noHtmlSpans: true, autolinks: true });
  return out
    .replace(/(<a [^>]*?href=")([^"]*)"/g, (_, pre: string, href: string) => `${pre}${safeHref(href)}" rel="noopener noreferrer"`)
    .replace(/(<img [^>]*?src=")([^"]*)"/g, (_, pre: string, src: string) => `${pre}${safeHref(src)}"`);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" };

/** Plain text of the first paragraph of rendered HTML, cut at `max` characters. */
export function excerpt(html: string, max = 240): string {
  const first = html.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? "";
  const text = first
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|apos);/g, (_, e: string) => ENTITIES[e] ?? _)
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export const asDate = (v: unknown): string | null => {
  const s = v instanceof Date ? v.toISOString() : String(v ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(Date.parse(s.slice(0, 10))) ? s.slice(0, 10) : null;
};

export const asTags = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []).map((t) => String(t).trim()).filter(Boolean);

/** True when drafts should be built too: `SHOW_DRAFTS=1` (see `bun run dev:drafts`). */
export const showDrafts = (): boolean => process.env.SHOW_DRAFTS === "1";

/** Every `.md` file in `dir` as { slug, file, source }. A missing folder is an empty collection. */
export function readMarkdownDir(dir: string): { slug: string; file: string; source: string }[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  return files.sort().map((f) => ({ slug: basename(f, ".md"), file: join(dir, f), source: readFileSync(join(dir, f), "utf8") }));
}
