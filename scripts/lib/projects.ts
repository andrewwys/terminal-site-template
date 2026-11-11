import { join } from "node:path";
import type { Project } from "../../src/data/types";
import { resolveImage, type Asset } from "./assets";
import { asDate, asTags, isHttpUrl, readMarkdownDir, renderMarkdown, showDrafts, splitFrontMatter } from "./markdown";

export const CONTENT_ROOT = join(import.meta.dir, "../../content");
export const PROJECTS_DIR = join(CONTENT_ROOT, "projects");

const KNOWN = ["title", "summary", "tags", "repo", "demo", "date", "featured", "order", "image", "imageAlt", "draft"];

/**
 * One project from its Markdown source. Returns null for drafts unless `drafts` is set.
 * Throws on any problem, so a broken project fails the build instead of vanishing.
 */
export function parseProject(
  source: string,
  slug: string,
  { file = join(PROJECTS_DIR, `${slug}.md`), contentRoot = CONTENT_ROOT, drafts = false } = {},
): { project: Project; asset?: Asset } | null {
  const { meta, body } = splitFrontMatter(source);
  if (meta.draft === true && !drafts) return null;
  const fail = (msg: string): never => {
    throw new Error(`projects/${slug}.md: ${msg}`);
  };
  for (const k of Object.keys(meta)) if (!KNOWN.includes(k)) fail(`unknown field "${k}" (known: ${KNOWN.join(", ")})`);

  const title = String(meta.title ?? "").trim() || fail("missing title");
  const summary = String(meta.summary ?? "").trim() || fail("missing summary");
  if (summary.length > 300) fail("summary must be at most 300 characters");
  const link = (key: "repo" | "demo"): string | undefined => {
    const v = meta[key];
    if (v === undefined || v === null || v === "") return undefined;
    return typeof v === "string" && isHttpUrl(v) ? v : fail(`${key} must be an https:// or http:// URL`);
  };
  const date = meta.date === undefined ? undefined : (asDate(meta.date) ?? fail("date must be YYYY-MM-DD"));
  if (meta.featured !== undefined && typeof meta.featured !== "boolean") fail("featured must be true or false");
  if (meta.order !== undefined && (typeof meta.order !== "number" || !Number.isFinite(meta.order))) fail("order must be a number");

  let asset: Asset | undefined;
  let image: Project["image"];
  if (meta.image !== undefined) {
    if (typeof meta.image !== "string") fail("image must be a path");
    asset = resolveImage(file, meta.image as string, contentRoot, "image");
    const alt = typeof meta.imageAlt === "string" ? meta.imageAlt.trim() : "";
    if (!alt) fail("imageAlt is required with image (describe the image for screen readers)");
    image = { src: asset.url, alt };
  } else if (meta.imageAlt !== undefined) fail("imageAlt is set but there's no image");

  const project: Project = {
    slug,
    title,
    summary,
    tags: asTags(meta.tags),
    repo: link("repo"),
    demo: link("demo"),
    date,
    featured: meta.featured === true,
    order: meta.order as number | undefined,
    image,
    html: renderMarkdown(body.trim()),
  };
  return { project, asset };
}

/** Featured first, then by `order`, then newest first, then by title. */
export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) ||
      (a.order ?? Infinity) - (b.order ?? Infinity) ||
      (b.date ?? "").localeCompare(a.date ?? "") ||
      a.title.localeCompare(b.title),
  );
}

/** Every published project in `dir`, sorted, plus the images they use. */
export function loadProjects(dir = PROJECTS_DIR, { contentRoot = CONTENT_ROOT, drafts = showDrafts() } = {}) {
  const parsed = readMarkdownDir(dir)
    .map((f) => parseProject(f.source, f.slug, { file: f.file, contentRoot, drafts }))
    .filter((p) => p !== null);
  return {
    projects: sortProjects(parsed.map((p) => p.project)),
    assets: parsed.flatMap((p) => (p.asset ? [p.asset] : [])),
  };
}
