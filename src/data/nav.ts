/**
 * The site's navigation, worked out from `config.pages`: what the tabs, number keys, Home menu,
 * `help` and `ls` show. Pure data, so the build (to write the tabs into index.html), the UI and
 * the tests all agree.
 */
import { esc } from "../lib/html";
import { PAGE_DEFAULTS } from "./pages";
import { site } from "./site";
import type { PageType, SiteContent } from "./types";

export interface NavEntry {
  id: string;
  type: PageType;
  /** Tab label and browser tab title. */
  title: string;
  /** Shown in `help`. */
  help: string;
  /** Shown in the Home menu. */
  menu: string;
  hidden: boolean;
}

/** Every page, in config order. */
export function navEntries(content: SiteContent = site()): NavEntry[] {
  return content.config.pages.map((p) => {
    const hidden = p.hidden === true;
    if (p.type === "markdown") {
      const doc = content.customPages.find((c) => c.id === p.id);
      const help = p.description ?? doc?.description ?? `read ${p.id}.md`;
      return { id: p.id, type: p.type, title: p.title ?? doc?.title ?? p.id, help, menu: help, hidden };
    }
    const d = PAGE_DEFAULTS[p.type];
    return {
      id: p.id,
      type: p.type,
      title: p.title ?? d.title,
      help: p.description ?? d.help,
      menu: p.description ?? d.menu ?? d.help,
      hidden,
    };
  });
}

/** The pages in the tabs, number keys, Home menu, `help` and `ls`. */
export const visibleEntries = (content?: SiteContent): NavEntry[] => navEntries(content).filter((e) => !e.hidden);

/** The id of the page of a given type, e.g. where `#/projects/<slug>` links should point. */
export const idOf = (type: PageType, content?: SiteContent): string | undefined =>
  navEntries(content).find((e) => e.type === type)?.id;

/** The home page's id: where the site starts and where unknown URLs go. */
export const homeId = (content?: SiteContent): string => idOf("home", content) ?? "home";

/** The visible page `delta` steps from `current`, wrapping around. From a hidden page, steps from Home. */
export function stepFrom(current: string, delta: number, content?: SiteContent): string {
  const visible = visibleEntries(content);
  let i = visible.findIndex((e) => e.id === current);
  if (i < 0) i = Math.max(0, visible.findIndex((e) => e.id === homeId(content)));
  return visible[(i + delta + visible.length * Math.abs(delta)) % visible.length]!.id;
}

/** Number keys reach the first nine visible pages. */
export const MAX_NUMBER_KEYS = 9;

/** The tab links, as written into index.html at build time and again at runtime. */
export function tabsMarkup(content?: SiteContent): string {
  return visibleEntries(content)
    .map((e, i) => {
      const key = i < MAX_NUMBER_KEYS ? `<span class="key" aria-hidden="true">${i + 1}</span>` : "";
      return `<a href="#/${esc(e.id)}" data-route="${esc(e.id)}">${key}${esc(e.title)}</a>`;
    })
    .join("");
}
