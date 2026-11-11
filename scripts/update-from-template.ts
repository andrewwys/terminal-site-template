#!/usr/bin/env bun
/**
 * Applies a newer copy of the template to this site. Run by .github/workflows/update-from-template.yml,
 * which then opens a pull request with the result.
 *
 * template.json lists the files the template owns (`files`). The update:
 *  - copies every file the new template lists;
 *  - deletes files the old template listed and the new one doesn't;
 *  - never touches anything else: site.config.json, content/, src/assets/, README.md and any
 *    file you added yourself.
 *
 * Usage: bun <new template>/scripts/update-from-template.ts <new template dir> [site dir] [--skip-workflows] [--summary file]
 * The workflow runs the *new* template's copy of this script, so it must not import other files.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const MANIFEST = "template.json";
/** Paths that belong to the site's owner. The template never lists them and an update never writes them. */
export const OWNER_PATHS = ["site.config.json", "content/", "src/assets/", "README.md"];
const WORKFLOWS = ".github/workflows/";

export interface TemplateManifest {
  /** The template repository, "owner/name". */
  template: string;
  /** The template's version, e.g. "v1.2.0". */
  version: string;
  /** Where the template was built from, "owner/name@commit". */
  source?: string;
  /** Every file the template owns, relative to the repo root. */
  files: string[];
}

export interface UpdateSummary {
  from: string | null;
  to: string;
  /** Files added or changed. */
  updated: string[];
  removed: string[];
  /** Workflow files that differ but were left alone (--skip-workflows). */
  skippedWorkflows: string[];
}

export const isOwnerPath = (path: string): boolean => OWNER_PATHS.some((o) => (o.endsWith("/") ? path.startsWith(o) : path === o));

/** A manifest path must be a plain relative path, outside .git and the owner's files. */
function checkPath(path: string): void {
  const parts = path.split("/");
  if (!path || path.startsWith("/") || path.includes("\\") || parts.some((p) => p === "" || p === "." || p === "..") || parts[0] === ".git")
    throw new Error(`${MANIFEST} lists an unsafe path: ${JSON.stringify(path)}`);
  if (isOwnerPath(path) || path === MANIFEST) throw new Error(`${MANIFEST} lists ${path}, which belongs to the site, not the template`);
}

export function readManifest(dir: string): TemplateManifest | null {
  const file = join(dir, MANIFEST);
  if (!existsSync(file)) return null;
  const m = JSON.parse(readFileSync(file, "utf8")) as Partial<TemplateManifest>;
  if (typeof m.template !== "string" || typeof m.version !== "string" || !Array.isArray(m.files) || m.files.some((f) => typeof f !== "string"))
    throw new Error(`${file} is not a template manifest`);
  m.files.forEach(checkPath);
  return m as TemplateManifest;
}

const same = (a: string, b: string): boolean => existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b));

/** Copies the new template's files over the site in `siteDir` and removes the ones it dropped. */
export function applyTemplate(templateDir: string, siteDir: string, { skipWorkflows = false } = {}): UpdateSummary {
  const next = readManifest(templateDir);
  if (!next) throw new Error(`${templateDir} has no ${MANIFEST}`);
  const prev = readManifest(siteDir);
  const summary: UpdateSummary = { from: prev?.version ?? null, to: next.version, updated: [], removed: [], skippedWorkflows: [] };
  const skip = (f: string) => skipWorkflows && f.startsWith(WORKFLOWS);

  for (const f of next.files) {
    const from = join(templateDir, f);
    const to = join(siteDir, f);
    if (!existsSync(from)) throw new Error(`${MANIFEST} lists ${f}, but the template doesn't have it`);
    if (same(from, to)) continue;
    if (skip(f)) {
      summary.skippedWorkflows.push(f);
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    summary.updated.push(f);
  }
  const kept = new Set(next.files);
  for (const f of prev?.files ?? []) {
    if (kept.has(f) || !existsSync(join(siteDir, f))) continue;
    if (skip(f)) {
      summary.skippedWorkflows.push(f);
      continue;
    }
    rmSync(join(siteDir, f));
    summary.removed.push(f);
  }
  writeFileSync(join(siteDir, MANIFEST), readFileSync(join(templateDir, MANIFEST)));
  return summary;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(name);
  const summaryAt = args.indexOf("--summary");
  const summaryFile = summaryAt >= 0 ? args[summaryAt + 1] : undefined;
  const [templateDir, siteDir = "."] = args.filter((a, i) => !a.startsWith("--") && i !== summaryAt + 1);
  if (!templateDir) {
    console.error("usage: bun update-from-template.ts <new template dir> [site dir] [--skip-workflows] [--summary file]");
    process.exit(2);
  }
  const summary = applyTemplate(templateDir, siteDir, { skipWorkflows: flag("--skip-workflows") });
  if (summaryFile) writeFileSync(summaryFile, JSON.stringify(summary, null, 2) + "\n");
  console.log(
    `template ${summary.from ?? "(unknown)"} → ${summary.to}: ${summary.updated.length} file(s) updated, ${summary.removed.length} removed` +
      (summary.skippedWorkflows.length ? `, ${summary.skippedWorkflows.length} workflow file(s) left for you to update` : ""),
  );
}
