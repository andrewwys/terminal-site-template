/**
 * The content the site is rendering. Pages read it through `site()` when they render, instead
 * of importing it, so the same pages can show any site: this one (from site.config.json and
 * content/posts at build time), a test fixture, or a live preview of a draft.
 */
import type { Profile, SiteContent } from "./types";

let current: SiteContent | null = null;

export function setSite(content: SiteContent): void {
  current = content;
}

export function site(): SiteContent {
  if (!current) throw new Error("no site content: call setSite() (or boot()) first");
  return current;
}

export const profile = (): Profile => site().config.profile;

/** "Ada Lovelace" → "Ada". */
export const firstName = (p: Profile = profile()): string => p.name.trim().split(/\s+/)[0] ?? p.name;

export const contactEmail = (p: Profile = profile()): string =>
  p.links.find((l) => l.id === "email")?.href.replace(/^mailto:/, "") ?? "";

export const formspreeConfigured = (p: Profile = profile()): boolean =>
  /^[A-Za-z0-9]{6,}$/.test(p.formspreeId) && p.formspreeId !== "YOUR_FORM_ID";
