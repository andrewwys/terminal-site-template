/** Rules for the `pages` list in site.config.json, shared by the build checks and the UI. */
import type { PageEntry, PageType } from "./types";

/**
 * Ids a page can't use: prompt commands (a page's id is also its command) and routes that are
 * planned (the Studio editor, /fork) or used by the build (`assets`).
 */
export const RESERVED_PAGE_IDS = [
  "help", "h", "cd", "ls", "whoami", "open", "clear", "date", "echo", "sudo", "rm",
  "studio", "edit", "login", "logout", "fork", "spawn", "init", "assets", "content", "api",
] as const;

export const PAGE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,30}$/;

/** Defaults for each built-in page type. `menu` is the Home menu text when it differs from `help`. */
export const PAGE_DEFAULTS: Record<Exclude<PageType, "markdown">, { title: string; help: string; menu?: string }> = {
  home: { title: "Home", help: "go to the home page" },
  about: { title: "About", help: "who I am", menu: "who I am, what I work with" },
  projects: { title: "Projects", help: "things I've built" },
  posts: { title: "Posts", help: "notes on what I'm building" },
  contact: { title: "Contact", help: "get in touch", menu: "say hello" },
};

/** The pages a version 1 config had, which had no `pages` list. */
export const V1_PAGES: PageEntry[] = [
  { id: "home", type: "home" },
  { id: "about", type: "about" },
  { id: "posts", type: "posts" },
  { id: "contact", type: "contact" },
];
