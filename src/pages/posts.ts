import { site } from "../data/site";
import type { Post } from "../data/types";
import { html, raw } from "../lib/html";
import type { Page } from "./types";

/** Newest first. Read at render time, so pages always show the current content. */
const allPosts = (): Post[] => site().posts;

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });


const tagList = (p: Post) =>
  p.tags.length ? html`<span class="post-tags dim">${p.tags.map((t) => html`<span>#${t}</span>`)}</span>` : "";

function postItem(p: Post, base: string) {
  return html`<li class="post" data-project="${p.project ?? ""}">
    <a class="post-link" data-nav href="#/${base}/${p.slug}">
      <span class="post-head">
        <span class="dot" aria-hidden="true">⏺</span>
        <span class="post-title">${p.title}</span>
        <time class="dim" datetime="${p.date}">${fmtDate(p.date)}</time>
      </span>
      <span class="post-body"><span class="elbow" aria-hidden="true">⎿</span><span class="post-text">${p.excerpt}</span></span>
      <span class="post-meta">${p.project ? html`<span class="project">${p.project}</span>` : ""}${tagList(p)}</span>
    </a>
  </li>`;
}

function listView(base: string) {
  const posts = allPosts();
  const projects = [...new Set(posts.map((p) => p.project).filter((p): p is string => !!p))];
  const filters =
    projects.length > 1
      ? html`<div class="filters" role="group" aria-label="Filter posts by project">
          ${["", ...projects].map(
            (f) => html`<button type="button" class="filter" data-nav data-filter="${f}" aria-pressed="${f === ""}">
              ${f || "All"} <span class="dim">(${f ? posts.filter((p) => p.project === f).length : posts.length})</span>
            </button>`,
          )}
        </div>`
      : "";
  return html`
    <section class="tool" aria-labelledby="posts-h">
      <h2 id="posts-h" class="tool-call"><span class="dot" aria-hidden="true">⏺</span> List<span class="dim">(${base}/)</span></h2>
      <div class="tool-result">
        <span class="elbow" aria-hidden="true">⎿</span>
        <p class="dim status-line">Found <strong class="fg">${posts.length}</strong> ${posts.length === 1 ? "post" : "posts"}</p>
      </div>
    </section>
    ${filters}
    ${
      posts.length
        ? html`<ul class="post-list">${posts.map((p) => postItem(p, base))}</ul>`
        : html`<p class="dim">No posts yet. Write one in <kbd>content/posts/</kbd> or run <kbd>bun run posts:import</kbd>.</p>`
    }`;
}

function postView(p: Post, base: string) {
  const posts = allPosts();
  const i = posts.indexOf(p);
  const newer = posts[i - 1];
  const older = posts[i + 1];
  return html`
    <article class="article" aria-labelledby="post-h">
      <a class="back dim" data-nav href="#/${base}">← all posts</a>
      <h1 id="post-h" class="article-title">${p.title}</h1>
      <p class="post-meta">
        <time class="dim" datetime="${p.date}">${fmtDate(p.date)}</time>
        ${p.project ? html`<span class="project">${p.project}</span>` : ""}
        ${tagList(p)}
      </p>
      <div class="article-body">${raw(p.html)}</div>
      ${
        p.linkedin
          ? html`<p><a class="btn linkedin" data-nav href="${p.linkedin}" target="_blank" rel="noopener noreferrer">View on LinkedIn ↗</a></p>`
          : ""
      }
      <nav class="article-nav" aria-label="More posts">
        ${newer ? html`<a class="dim" data-nav href="#/${base}/${newer.slug}">← ${newer.title}</a>` : html`<span></span>`}
        ${older ? html`<a class="dim" data-nav href="#/${base}/${older.slug}">${older.title} →</a>` : ""}
      </nav>
    </article>`;
}

const find = (slug?: string) => (slug ? allPosts().find((p) => p.slug === slug) : undefined);

/** The posts page, served at `#/<id>` (normally `posts`). */
export const createPostsPage = (id = "posts"): Page => ({
  id,
  title: "Posts",
  command: (slug) => (find(slug) ? `cat ${id}/${slug}.md` : `ls -t ${id}/`),
  pageTitle: (slug) => find(slug)?.title,
  render: (slug) => {
    if (!slug) return listView(id);
    const p = find(slug);
    return p
      ? postView(p, id)
      : html`<p class="err">cat: ${id}/${slug}.md: No such file or directory</p>
          <p><a class="back dim" data-nav href="#/${id}">← all posts</a></p>`;
  },
  mount: (root) => {
    const buttons = root.querySelectorAll<HTMLButtonElement>(".filter");
    for (const btn of buttons) {
      btn.addEventListener("click", () => {
        const f = btn.dataset.filter ?? "";
        for (const b of buttons) b.setAttribute("aria-pressed", String(b === btn));
        for (const li of root.querySelectorAll<HTMLElement>(".post")) li.hidden = f !== "" && li.dataset.project !== f;
      });
    }
  },
});
