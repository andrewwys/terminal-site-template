import { site } from "../data/site";
import type { Project } from "../data/types";
import { html, raw } from "../lib/html";
import type { Page } from "./types";

/** Already sorted at build time: featured first, then `order`, then newest. */
const allProjects = (): Project[] => site().projects;

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { year: "numeric", month: "short", timeZone: "UTC" });

const tagList = (p: Project) =>
  p.tags.length ? html`<span class="post-tags dim">${p.tags.map((t) => html`<span>#${t}</span>`)}</span>` : "";

const featuredMark = (p: Project) => (p.featured ? html`<span class="featured">★ featured</span>` : "");

function projectItem(p: Project, base: string) {
  return html`<li class="post project-item" data-tags="${p.tags.join(" ")}">
    <a class="post-link proj-link${p.image ? " has-image" : ""}" data-nav href="#/${base}/${p.slug}">
      <span class="post-head">
        <span class="dot" aria-hidden="true">⏺</span>
        <span class="post-title">${p.title}</span>
        ${p.date ? html`<time class="dim" datetime="${p.date}">${fmtDate(p.date)}</time>` : ""}
      </span>
      <span class="post-body"><span class="elbow" aria-hidden="true">⎿</span><span class="post-text">${p.summary}</span></span>
      <span class="post-meta">${featuredMark(p)}${tagList(p)}</span>
      ${p.image ? html`<img class="proj-thumb" src="${p.image.src}" alt="" loading="lazy" decoding="async" />` : ""}
    </a>
  </li>`;
}

function listView(base: string) {
  const projects = allProjects();
  const tags = [...new Set(projects.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b));
  const filters =
    tags.length > 1
      ? html`<div class="filters" role="group" aria-label="Filter projects by technology">
          ${["", ...tags].map(
            (t) => html`<button type="button" class="filter" data-nav data-filter="${t}" aria-pressed="${t === ""}">
              ${t || "All"} <span class="dim">(${t ? projects.filter((p) => p.tags.includes(t)).length : projects.length})</span>
            </button>`,
          )}
        </div>`
      : "";
  return html`
    <section class="tool" aria-labelledby="projects-h">
      <h2 id="projects-h" class="tool-call"><span class="dot" aria-hidden="true">⏺</span> List<span class="dim">(${base}/)</span></h2>
      <div class="tool-result">
        <span class="elbow" aria-hidden="true">⎿</span>
        <p class="dim status-line">Found <strong class="fg">${projects.length}</strong> ${projects.length === 1 ? "project" : "projects"}</p>
      </div>
    </section>
    ${filters}
    ${
      projects.length
        ? html`<ul class="post-list">${projects.map((p) => projectItem(p, base))}</ul>`
        : html`<p class="dim">No projects yet. Add one in <kbd>content/projects/</kbd>.</p>`
    }`;
}

function projectView(p: Project, base: string) {
  const projects = allProjects();
  const i = projects.indexOf(p);
  const prev = projects[i - 1];
  const next = projects[i + 1];
  const links = [
    p.repo ? html`<a class="btn" data-nav href="${p.repo}" target="_blank" rel="noopener noreferrer">Source ↗</a>` : "",
    p.demo ? html`<a class="btn" data-nav href="${p.demo}" target="_blank" rel="noopener noreferrer">Live demo ↗</a>` : "",
  ];
  return html`
    <article class="article" aria-labelledby="project-h">
      <a class="back dim" data-nav href="#/${base}">← all projects</a>
      <h1 id="project-h" class="article-title">${p.title}</h1>
      <p class="post-meta">
        ${p.date ? html`<time class="dim" datetime="${p.date}">${fmtDate(p.date)}</time>` : ""}
        ${featuredMark(p)}
        ${tagList(p)}
      </p>
      <p class="lead">${p.summary}</p>
      ${p.image ? html`<img class="proj-image" src="${p.image.src}" alt="${p.image.alt}" decoding="async" />` : ""}
      ${p.repo || p.demo ? html`<p class="proj-links">${links}</p>` : ""}
      ${p.html ? html`<div class="article-body">${raw(p.html)}</div>` : ""}
      <nav class="article-nav" aria-label="More projects">
        ${prev ? html`<a class="dim" data-nav href="#/${base}/${prev.slug}">← ${prev.title}</a>` : html`<span></span>`}
        ${next ? html`<a class="dim" data-nav href="#/${base}/${next.slug}">${next.title} →</a>` : ""}
      </nav>
    </article>`;
}

const find = (slug?: string) => (slug ? allProjects().find((p) => p.slug === slug) : undefined);

/** The projects page, served at `#/<id>` (normally `projects`). */
export const createProjectsPage = (id = "projects"): Page => ({
  id,
  title: "Projects",
  command: (slug) => (find(slug) ? `cat ${id}/${slug}.md` : `ls ${id}/`),
  pageTitle: (slug) => find(slug)?.title,
  render: (slug) => {
    if (!slug) return listView(id);
    const p = find(slug);
    return p
      ? projectView(p, id)
      : html`<p class="err">cat: ${id}/${slug}.md: No such file or directory</p>
          <p><a class="back dim" data-nav href="#/${id}">← all projects</a></p>`;
  },
  mount: (root) => {
    const buttons = root.querySelectorAll<HTMLButtonElement>(".filter");
    for (const btn of buttons) {
      btn.addEventListener("click", () => {
        const t = btn.dataset.filter ?? "";
        for (const b of buttons) b.setAttribute("aria-pressed", String(b === btn));
        for (const li of root.querySelectorAll<HTMLElement>(".project-item"))
          li.hidden = t !== "" && !(li.dataset.tags ?? "").split(" ").includes(t);
      });
    }
  },
});
