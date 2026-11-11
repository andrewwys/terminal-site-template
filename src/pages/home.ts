import { heroMarkup, mountHero } from "../components/hero";
import { visibleEntries } from "../data/nav";
import { profile } from "../data/site";
import { html } from "../lib/html";
import type { Page } from "./types";

/** "Tips for getting started": every visible page except Home, in tab order. */
const menu = () => visibleEntries().filter((e) => e.type !== "home");

export const home: Page = {
  id: "home",
  title: "Home",
  command: "whoami",
  render: () => {
    const p = profile();
    return html`
    <section class="welcome" aria-label="Welcome">
      <p><span class="accent">✻</span> Welcome to <strong>${p.name}</strong>'s terminal!</p>
      <p class="dim indent"><kbd>/help</kbd> for help · <kbd>←</kbd><kbd>→</kbd> switch pages · <kbd>↑</kbd><kbd>↓</kbd> select · <kbd>↵</kbd> open</p>
      <p class="dim indent">cwd: ~/${p.handle}</p>
    </section>

    ${heroMarkup()}

    <header class="identity">
      <h1 class="name">${p.name}</h1>
      <p class="role">${p.title}</p>
      <ul class="keywords" aria-label="Focus areas">
        ${p.keywords.map((k) => html`<li>${k}</li>`)}
      </ul>
    </header>

    <section class="block" aria-labelledby="tips">
      <h2 id="tips" class="block-title">Tips for getting started:</h2>
      <ol class="menu">
        ${menu().map(
          (m, i) => html`<li><a class="menu-item" data-nav href="#/${m.id}">
              <span class="num">${i + 1}.</span> <span class="label">${m.title}</span> <span class="dim">— ${m.menu}</span>
            </a></li>`,
        )}
      </ol>
    </section>
  `;
  },
  mount: (root) => mountHero(root),
};
