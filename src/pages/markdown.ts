import { site } from "../data/site";
import { html, raw } from "../lib/html";
import type { Page } from "./types";

/** A custom page from content/pages/<id>.md. */
export function createMarkdownPage(id: string): Page {
  const doc = () => site().customPages.find((c) => c.id === id);
  return {
    id,
    title: id,
    command: () => doc()?.command ?? `cat ${id}.md`,
    render: () => {
      const d = doc();
      if (!d) return html`<p class="err">cat: ${id}.md: No such file or directory</p>`;
      return html`<article class="article" aria-labelledby="page-h">
        <h1 id="page-h" class="article-title">${d.title}</h1>
        <div class="article-body">${raw(d.html)}</div>
      </article>`;
    },
  };
}
