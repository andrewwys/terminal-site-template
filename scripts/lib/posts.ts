import { basename, join } from "node:path";
import type { Post } from "../../src/data/types";
import { asDate, asTags, excerpt, isHttpUrl, readMarkdownDir, renderMarkdown, showDrafts, splitFrontMatter } from "./markdown";

export { excerpt, renderMarkdown, safeHref, splitFrontMatter } from "./markdown";

export const CONTENT_DIR = join(import.meta.dir, "../../content/posts");

/**
 * One site post from its Markdown source. Returns null for drafts (`draft: true`).
 * Throws on a missing title or date, so a broken post fails the build instead of vanishing.
 */
export function parsePost(source: string, slug: string, { drafts = false } = {}): Post | null {
  const { meta, body } = splitFrontMatter(source);
  if (meta.draft === true && !drafts) return null;
  const title = String(meta.title ?? "").trim();
  const date = asDate(meta.date);
  if (!title) throw new Error(`${slug}: missing title`);
  if (!date) throw new Error(`${slug}: missing or invalid date (YYYY-MM-DD)`);
  const linkedin = typeof meta.linkedin === "string" && isHttpUrl(meta.linkedin) ? meta.linkedin : undefined;
  const project = typeof meta.project === "string" && meta.project.trim() ? meta.project.trim() : undefined;
  const html = renderMarkdown(body.trim());
  return { slug, title, date, project, tags: asTags(meta.tags), linkedin, html, excerpt: excerpt(html) };
}

/** Every published post in `dir`, newest first. Drafts are included only with `drafts`. */
export function loadPosts(dir = CONTENT_DIR, { drafts = showDrafts() } = {}): Post[] {
  return readMarkdownDir(dir)
    .map((f) => parsePost(f.source, f.slug, { drafts }))
    .filter((p): p is Post => p !== null)
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

// ── Import from rich-world-godot/Sharing ──────────────────────────────────────

/** The text under `## <heading>`, up to the next `#`/`##` heading (same rule as Sharing/scripts/post.mjs). */
export function section(body: string, heading: string): string | null {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (start < 0) return null;
  const out: string[] = [];
  for (const l of lines.slice(start + 1)) {
    if (/^#{1,2}\s/.test(l)) break;
    out.push(l);
  }
  return out.join("\n").trim();
}

/** Drops a last paragraph made only of hashtags: they're for LinkedIn, the site has tags. */
export const stripHashtagLine = (text: string): string =>
  text.replace(/\n\s*\n(?:#[\p{L}\p{N}_]+\s*)+$/u, "").trim();

const yamlString = (s: string) => JSON.stringify(s);

export interface SharingImport {
  slug: string;
  status: string;
  /** The site post as Markdown, or null when the Sharing post has no LinkedIn text. */
  markdown: string | null;
}

/**
 * Converts one post from rich-world-godot/Sharing/posts into a site post: the `#` title
 * becomes the title, the `## LinkedIn` section the body, and `linkedin_url` the link.
 */
export function fromSharing(source: string, file: string, project = "Rich World"): SharingImport {
  const slug = basename(file, ".md");
  const { meta, body } = splitFrontMatter(source);
  const status = String(meta.status ?? "");
  const text = section(body, "LinkedIn");
  const title = body.match(/^# (.+)$/m)?.[1]?.trim() ?? slug;
  if (!text) return { slug, status, markdown: null };
  const date = asDate(meta.posted_at) ?? asDate(meta.created) ?? new Date().toISOString().slice(0, 10);
  const tags = asTags(meta.tags);
  const url = typeof meta.linkedin_url === "string" && isHttpUrl(meta.linkedin_url) ? meta.linkedin_url : "";
  const front = [
    "---",
    `title: ${yamlString(title)}`,
    `date: ${date}`,
    `project: ${yamlString(project)}`,
    `tags: [${tags.join(", ")}]`,
    ...(url ? [`linkedin: ${url}`] : []),
    `source: rich-world-godot/Sharing/posts/${slug}.md`,
    "---",
  ];
  return { slug, status, markdown: `${front.join("\n")}\n\n${stripHashtagLine(text)}\n` };
}
