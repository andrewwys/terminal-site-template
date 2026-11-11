import type { Raw } from "../lib/html";
import type { KeyNav } from "../lib/keynav";

export interface PageContext {
  nav: KeyNav;
}

export interface Page {
  /** The page's id from config.pages: its URL `#/<id>` and prompt command. */
  id: string;
  title: string;
  /** The command "typed" at the top of the page, e.g. `cat about.md`. */
  command: string | ((param?: string) => string);
  /** Browser tab title for a sub-page such as `#/posts/<slug>`; defaults to `title`. */
  pageTitle?(param?: string): string | undefined;
  /** `param` is the rest of the route, e.g. the slug in `#/posts/<slug>`. */
  render(param?: string): Raw;
  /** Wire up behaviour after render. May return a cleanup function. */
  mount?(root: HTMLElement, ctx: PageContext): (() => void) | void;
}
