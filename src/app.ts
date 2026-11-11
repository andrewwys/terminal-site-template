/**
 * The whole terminal UI: router, prompt, keyboard handling and boot sequence.
 * `boot(content)` starts it for any site content; src/main.ts passes this site's.
 */
import { runBoot } from "./components/boot";
import { Prompt, type Command } from "./components/prompt";
import { homeId, MAX_NUMBER_KEYS, navEntries, stepFrom, tabsMarkup } from "./data/nav";
import { setSite } from "./data/site";
import { studioLink } from "./data/studio";
import type { SiteContent } from "./data/types";
import { html } from "./lib/html";
import { KeyNav } from "./lib/keynav";
import { typeText } from "./lib/motion";
import { pageFor } from "./pages";
import type { Page } from "./pages/types";

/**
 * Pages that aren't in config.pages: tools rather than content. They have a URL but no tab,
 * command or menu entry, and their ids are reserved (see RESERVED_PAGE_IDS). None yet: the Studio
 * editor runs on its own origin (src/studio/, studio.andrewwy.com), not as a page of the site.
 */
const SYSTEM_PAGES: Page[] = [];

let started = false;

/** Renders `content` into the terminal shell in index.html. Call once per page load. */
export function boot(content: SiteContent): void {
  if (started) throw new Error("boot() was already called");
  started = true;
  setSite(content);
  const { profile } = content.config;

  const setText = (sel: string, text: string) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
  };
  setText("#site-name", content.config.site.name);
  setText("#status-title", profile.title);

  const view = document.querySelector<HTMLElement>("#view")!;
  const tabs = document.querySelector<HTMLElement>("#tabs")!;
  const crumb = document.querySelector<HTMLElement>("#crumb")!;

  // Pages come from config.pages, in tab order. Hidden pages have a URL and a command but no tab.
  const entries = navEntries(content);
  const visible = entries.filter((e) => !e.hidden);
  const byId = new Map(entries.map((e) => [e.id, { entry: e, page: pageFor(e) }]));
  for (const page of SYSTEM_PAGES)
    byId.set(page.id, { entry: { id: page.id, type: "markdown", title: page.title, help: "", menu: "", hidden: true }, page });
  const home = homeId(content);
  tabs.innerHTML = tabsMarkup(content);
  const toHome = (id: string) => (id === home ? "" : id);

  const nav = new KeyNav(view);
  let current: string | null = null;
  let currentKey: string | null = null;
  let cleanup: (() => void) | void;
  let typing: AbortController | null = null;

  /** `#/posts/some-slug` → { id: "posts", param: "some-slug" }. */
  const routeFromHash = (): { id: string; param?: string } => {
    const [id = "", rest] = location.hash.replace(/^#\/?/, "").split("?")[0]!.split(/\/(.*)/);
    if (!byId.has(id)) return { id: home };
    let param: string | undefined;
    try {
      param = rest ? decodeURIComponent(rest.replace(/\/$/, "")) || undefined : undefined;
    } catch {
      param = rest;
    }
    return { id, param };
  };

  function go(id: string): void {
    if (`#/${id}` === location.hash) return;
    location.hash = `#/${id}`;
  }

  function step(delta: number): void {
    go(stepFrom(current ?? home, delta, content));
  }

  async function render(id: string, param?: string): Promise<void> {
    const key = param ? `${id}/${param}` : id;
    if (key === currentKey) return;
    cleanup?.();
    typing?.abort();
    typing = new AbortController();
    current = id;
    currentKey = key;
    const { entry, page } = byId.get(id)!;

    const title = page.pageTitle?.(param) ?? page.title;
    document.title = id === home ? `${profile.name} — ${profile.title}` : `${title} · ${profile.name}`;
    for (const a of tabs.querySelectorAll<HTMLAnchorElement>("a[data-route]")) {
      const on = a.dataset.route === id;
      a.classList.toggle("active", on);
      if (on) {
        a.setAttribute("aria-current", "page");
        // The tab bar scrolls sideways on narrow screens: keep the current tab in view.
        a.scrollIntoView({ block: "nearest", inline: "nearest" });
      } else a.removeAttribute("aria-current");
    }
    crumb.textContent = id === home ? "~" : `~/${key}`;

    view.innerHTML = html`
      <p class="cmdline" aria-hidden="true"><span class="ps1">›</span> <span class="cmd-typed"></span><span class="cursor"></span></p>
      <div class="page page-${entry.type} pending">${page.render(param)}</div>`.value;
    const body = view.querySelector<HTMLElement>(".page")!;
    nav.reset();
    window.scrollTo({ top: 0 });

    cleanup = page.mount?.(body, { nav });
    const command = typeof page.command === "function" ? page.command(param) : page.command;
    await typeText(view.querySelector(".cmd-typed")!, command, { cps: 45, signal: typing.signal });
    body.classList.remove("pending");
  }

  // ── Command prompt ────────────────────────────────────────────────────────────
  const linkFor = (id: string) => profile.links.find((l) => l.id === id);

  const commands: Command[] = [
    {
      name: "help",
      aliases: ["?", "h"],
      desc: "show commands and shortcuts",
      run: () => html`<div class="help">
        <p class="dim">Commands</p>
        <ul>${commands
          .filter((c) => !c.hidden)
          .map((c) => html`<li><span class="accent">/${c.name}</span><span class="dim">${c.desc}</span></li>`)}</ul>
        <p class="dim">Shortcuts</p>
        <ul>
          <li><span class="accent">← →</span><span class="dim">previous / next page</span></li>
          <li><span class="accent">↑ ↓</span><span class="dim">move selection (also j / k)</span></li>
          <li><span class="accent">↵</span><span class="dim">open selected item</span></li>
          <li><span class="accent">1–${Math.min(MAX_NUMBER_KEYS, visible.length)}</span><span class="dim">jump to page</span></li>
          <li><span class="accent">/</span><span class="dim">focus this prompt · Tab completes</span></li>
          <li><span class="accent">esc</span><span class="dim">clear selection / leave a field</span></li>
        </ul>
      </div>`,
    },
    ...entries.map<Command>((e) => ({
      name: e.id,
      desc: e.help,
      hidden: e.hidden,
      run: () => {
        go(e.id);
        return `navigating to ~/${toHome(e.id)}`;
      },
    })),
    {
      name: "cd",
      desc: "change page, e.g. cd posts",
      hidden: true,
      run: ([to = ""]) => {
        const id = to.replace(/^~?\/?/, "").replace(/\/$/, "") || home;
        if (!byId.has(id)) return html`<span class="err">cd: no such directory: ${to}</span>`;
        go(id);
        return `~/${toHome(id)}`;
      },
    },
    { name: "ls", desc: "list pages", run: () => visible.map((e) => `${e.id}/`).join("  ") },
    {
      name: "whoami",
      desc: "short intro",
      run: () => html`<strong>${profile.name}</strong> · ${profile.title} · <span class="accent">${profile.keywords.join(" · ")}</span>`,
    },
    {
      name: "open",
      desc: "open github | linkedin | x | email",
      run: ([target = ""]) => {
        const link = linkFor(target.toLowerCase());
        if (!link) return html`usage: <kbd>open github|linkedin|x|email</kbd>`;
        window.open(link.href, link.id === "email" ? "_self" : "_blank", "noopener");
        return `opening ${link.display}`;
      },
    },
    {
      name: "edit",
      aliases: ["login", "studio"],
      desc: "edit this site in the Studio",
      hidden: true, // for the site's owner; visitors get /fork later
      run: () => {
        const url = studioLink(content.config.site.repo);
        window.open(url, "_blank", "noopener");
        return html`opening the Studio: <a href="${url}" target="_blank" rel="noopener">${url}</a>`;
      },
    },
    {
      name: "fork",
      aliases: ["spawn", "init"],
      desc: "make your own copy of this site (coming soon)",
      // Placeholder until /fork is built (docs/proposals/fork-your-own-site.md, phase 5).
      run: () => html`<span class="warn">/fork is coming soon.</span> It will create a copy of this site in your own
        GitHub account and deploy it to GitHub Pages. The code is MIT-licensed, so you can already
        copy it from <a href="https://github.com/andrewwys/bun-andrewwy" target="_blank" rel="noopener">the repo</a>.`,
    },
    { name: "clear", desc: "clear this output", run: () => {} },
    { name: "date", desc: "", hidden: true, run: () => new Date().toString() },
    { name: "echo", desc: "", hidden: true, run: (args) => args.join(" ") },
    {
      name: "sudo",
      desc: "",
      hidden: true,
      run: () => html`<span class="err">${profile.handle} is not in the sudoers file. This incident will be reported.</span>`,
    },
    {
      name: "rm",
      desc: "",
      hidden: true,
      run: () => html`<span class="warn">Nice try. Everything here is in git anyway.</span>`,
    },
  ];

  const prompt = new Prompt(
    document.querySelector<HTMLFormElement>("#prompt")!,
    document.querySelector<HTMLElement>("#cmd-out")!,
    document.querySelector<HTMLElement>("#cmd-suggest")!,
    commands,
  );

  // ── Keyboard ──────────────────────────────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target instanceof HTMLElement ? e.target : null;

    if (target?.closest("input, textarea, select, [contenteditable]")) {
      if (target === prompt.input) return; // the prompt handles its own keys
      if (e.key === "Escape") {
        target.blur();
        e.preventDefault();
      } else if (target.tagName === "INPUT" && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        nav.move(e.key === "ArrowDown" ? 1 : -1);
      }
      return;
    }

    if (/^[1-9]$/.test(e.key)) {
      // Number keys jump to the first nine visible pages.
      const to = visible[Number(e.key) - 1];
      if (to) {
        go(to.id);
        e.preventDefault();
      }
      return;
    }

    let handled = true;
    switch (e.key) {
      case "ArrowLeft":
      case "h":
        step(-1);
        break;
      case "ArrowRight":
      case "l":
        step(1);
        break;
      case "ArrowDown":
      case "j":
        handled = nav.move(1);
        break;
      case "ArrowUp":
      case "k":
        handled = nav.move(-1);
        break;
      case "Home":
        handled = nav.first();
        break;
      case "End":
        handled = nav.last();
        break;
      case "/":
        prompt.focus("/");
        break;
      case "?":
        prompt.run("help");
        break;
      case "Escape":
        nav.clear();
        prompt.clear();
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  });

  // ── Boot ──────────────────────────────────────────────────────────────────────
  const renderRoute = () => {
    const { id, param } = routeFromHash();
    void render(id, param);
  };
  window.addEventListener("hashchange", renderRoute);
  renderRoute();
  void runBoot();
}
