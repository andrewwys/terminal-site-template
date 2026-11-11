import { prefersReducedMotion } from "./motion";

/**
 * Menu-style selection over every `[data-nav]` element inside `root`.
 * Keyboard (↑/↓) and mouse (hover/focus) share the same selection, like a
 * Claude Code picker: the selected item gets the `.selected` class and a ❯ marker.
 */
export class KeyNav {
  private index = -1;

  constructor(private readonly root: HTMLElement) {
    root.addEventListener("mouseover", (e) => {
      const el = this.itemFrom(e.target);
      if (el && !el.classList.contains("selected")) this.mark(el);
    });
    root.addEventListener("mouseout", (e) => {
      const el = this.itemFrom(e.target);
      const to = this.itemFrom(e.relatedTarget);
      // Leaving an item with the mouse un-highlights it unless it still has keyboard focus.
      if (el && to !== el && document.activeElement !== el) el.classList.remove("selected");
    });
    root.addEventListener("focusin", (e) => {
      const el = this.itemFrom(e.target);
      if (el) this.mark(el);
    });
  }

  private itemFrom(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null;
    const el = target.closest<HTMLElement>("[data-nav]");
    return el && this.root.contains(el) ? el : null;
  }

  items(): HTMLElement[] {
    return Array.from(this.root.querySelectorAll<HTMLElement>("[data-nav]")).filter(
      (el) => !el.hidden && el.getClientRects().length > 0 && !el.hasAttribute("disabled"),
    );
  }

  private mark(el: HTMLElement): void {
    const items = this.items();
    this.index = items.indexOf(el);
    for (const item of items) item.classList.toggle("selected", item === el);
  }

  select(el: HTMLElement): void {
    this.mark(el);
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  /** Moves the selection; returns false when there is nothing to select. */
  move(delta: number): boolean {
    const items = this.items();
    if (items.length === 0) return false;
    const live = items.findIndex((i) => i === document.activeElement);
    const from = live >= 0 ? live : this.index;
    const next =
      from < 0 ? (delta > 0 ? 0 : items.length - 1) : (from + delta + items.length) % items.length;
    this.select(items[next]!);
    return true;
  }

  first(): boolean {
    const [el] = this.items();
    if (el) this.select(el);
    return !!el;
  }

  last(): boolean {
    const el = this.items().at(-1);
    if (el) this.select(el);
    return !!el;
  }

  clear(): void {
    this.index = -1;
    for (const item of this.items()) item.classList.remove("selected");
    if (document.activeElement instanceof HTMLElement && this.root.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  }

  reset(): void {
    this.index = -1;
  }
}
