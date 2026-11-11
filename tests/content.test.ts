import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_IMAGE_BYTES, resolveImage } from "../scripts/lib/assets";
import { loadContent } from "../scripts/lib/content";
import { loadCustomPages, parseCustomPage } from "../scripts/lib/custom-pages";
import { loadPosts } from "../scripts/lib/posts";
import { loadProjects, parseProject, sortProjects } from "../scripts/lib/projects";
import { fixtureProject, fixtureSite } from "./fixtures/site";

/** A throwaway content/ folder with projects/ and pages/. */
function contentDir() {
  const root = mkdtempSync(join(tmpdir(), "content-"));
  for (const d of ["projects", "pages", "posts"]) mkdirSync(join(root, d));
  const write = (rel: string, text: string | Buffer) => writeFileSync(join(root, rel), text);
  return { root, write, projects: join(root, "projects") };
}

const project = (front: string, body = "") => `---\n${front}\n---\n\n${body}`;

describe("parseProject", () => {
  test("reads every field and renders the body", () => {
    const c = contentDir();
    c.write("projects/shot.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const r = parseProject(
      project(
        `title: Engine\nsummary: A computer.\ntags: [brass, steam]\nrepo: https://github.com/ada/engine\ndemo: https://engine.example.org\ndate: 1837-01-01\nfeatured: true\norder: 2\nimage: shot.png\nimageAlt: The engine`,
        "Designed in **1837**.",
      ),
      "engine",
      { file: join(c.projects, "engine.md"), contentRoot: c.root },
    )!;
    expect(r.project).toEqual({
      slug: "engine",
      title: "Engine",
      summary: "A computer.",
      tags: ["brass", "steam"],
      repo: "https://github.com/ada/engine",
      demo: "https://engine.example.org",
      date: "1837-01-01",
      featured: true,
      order: 2,
      image: { src: expect.stringMatching(/^assets\/c\/shot-[0-9a-f]{8}\.png$/), alt: "The engine" },
      html: "<p>Designed in <strong>1837</strong>.</p>\n",
    });
    expect(r.asset).toEqual({ file: join(c.projects, "shot.png"), url: r.project.image!.src });
  });

  test("only title and summary are required", () => {
    const r = parseProject(project("title: Tiny\nsummary: Small."), "tiny")!;
    expect(r.project).toMatchObject({ title: "Tiny", tags: [], featured: false, html: "" });
    expect(r.project.repo).toBeUndefined();
    expect(r.asset).toBeUndefined();
  });

  test("drafts are skipped unless asked for", () => {
    const src = project("title: WIP\nsummary: Not yet.\ndraft: true");
    expect(parseProject(src, "wip")).toBeNull();
    expect(parseProject(src, "wip", { drafts: true })?.project.title).toBe("WIP");
  });

  test("problems fail with the file and field named", () => {
    const bad = (front: string) => () => parseProject(project(front), "bad");
    expect(bad("summary: x")).toThrow("projects/bad.md: missing title");
    expect(bad("title: x")).toThrow("missing summary");
    expect(bad("title: x\nsummary: y\nrepo: javascript:alert(1)")).toThrow("repo must be an https:// or http:// URL");
    expect(bad("title: x\nsummary: y\ndate: soon")).toThrow("date must be YYYY-MM-DD");
    expect(bad("title: x\nsummary: y\nfeatured: yes")).toThrow("featured must be true or false");
    expect(bad("title: x\nsummary: y\norder: first")).toThrow("order must be a number");
    expect(bad("title: x\nsummary: y\nlink: https://x.org")).toThrow('unknown field "link"');
    expect(bad("title: x\nsummary: y\nimageAlt: a cat")).toThrow("imageAlt is set but there's no image");
  });

  test("images must be real, local, small image files, with alt text", () => {
    const c = contentDir();
    c.write("projects/ok.webp", "webp");
    c.write("projects/notes.txt", "x");
    c.write("projects/big.png", Buffer.alloc(MAX_IMAGE_BYTES + 1));
    const md = join(c.projects, "p.md");
    const img = (rel: string) => () => resolveImage(md, rel, c.root, "image");
    expect(img("https://example.com/x.png")).toThrow("must be a path relative to the .md file, not a URL");
    expect(img("/etc/x.png")).toThrow("not a URL");
    expect(img("../../outside.png")).toThrow("must stay inside content/");
    expect(img("notes.txt")).toThrow("must be one of .svg, .png, .jpg, .jpeg, .webp, .gif");
    expect(img("missing.png")).toThrow("no file at missing.png");
    expect(img("big.png")).toThrow("the limit is 1024 KB");
    expect(img("ok.webp")().url).toMatch(/^assets\/c\/ok-[0-9a-f]{8}\.webp$/);
    expect(() =>
      parseProject(project("title: x\nsummary: y\nimage: ok.webp"), "p", { file: md, contentRoot: c.root }),
    ).toThrow("imageAlt is required with image");
  });

  test("an image's URL changes when its content does, so long caching is safe", () => {
    const c = contentDir();
    const md = join(c.projects, "p.md");
    c.write("projects/a.png", "one");
    const first = resolveImage(md, "a.png", c.root, "image").url;
    c.write("projects/a.png", "two");
    expect(resolveImage(md, "a.png", c.root, "image").url).not.toBe(first);
  });
});

describe("loadProjects and sortProjects", () => {
  test("featured first, then order, then newest, then title", () => {
    const p = (slug: string, over: object) => fixtureProject({ slug, title: slug, ...over });
    const sorted = sortProjects([
      p("old", { date: "2020-01-01" }),
      p("ordered-2", { order: 2 }),
      p("new", { date: "2024-01-01" }),
      p("featured", { featured: true, order: 9 }),
      p("ordered-1", { order: 1 }),
      p("b-undated", {}),
      p("a-undated", {}),
    ]);
    expect(sorted.map((x) => x.slug)).toEqual(["featured", "ordered-1", "ordered-2", "new", "old", "a-undated", "b-undated"]);
  });

  test("reads a folder, skips drafts, and lists the images used", () => {
    const c = contentDir();
    c.write("projects/pic.svg", "<svg/>");
    c.write("projects/a.md", project("title: A\nsummary: a\nimage: pic.svg\nimageAlt: A picture"));
    c.write("projects/b.md", project("title: B\nsummary: b\nfeatured: true"));
    c.write("projects/c.md", project("title: C\nsummary: c\ndraft: true"));
    const { projects, assets } = loadProjects(c.projects, { contentRoot: c.root, drafts: false });
    expect(projects.map((p) => p.slug)).toEqual(["b", "a"]);
    expect(assets).toHaveLength(1);
    expect(loadProjects(c.projects, { contentRoot: c.root, drafts: true }).projects).toHaveLength(3);
    expect(loadProjects(join(c.root, "missing")).projects).toEqual([]);
  });
});

describe("custom pages", () => {
  test("parse title, command, description and body", () => {
    expect(parseCustomPage("---\ntitle: Uses\ncommand: cat ~/uses.md\ndescription: my tools\n---\n\n*Vim*", "uses")).toEqual({
      id: "uses",
      title: "Uses",
      command: "cat ~/uses.md",
      description: "my tools",
      html: "<p><em>Vim</em></p>\n",
    });
    expect(() => parseCustomPage("---\ncommand: x\n---\n", "uses")).toThrow("pages/uses.md: missing title");
    expect(() => parseCustomPage("---\ntitle: x\nhidden: true\n---\n", "uses")).toThrow('unknown field "hidden"');
  });

  test("one per markdown entry in the config; a listed page without a file fails", () => {
    const c = contentDir();
    c.write("pages/uses.md", "---\ntitle: Uses\n---\n\nHi");
    c.write("pages/unlisted.md", "---\ntitle: Not in the config\n---\n");
    const config = fixtureSite().config;
    config.pages = [{ id: "home", type: "home" }, { id: "uses", type: "markdown" }];
    expect(loadCustomPages(config, join(c.root, "pages")).map((p) => p.id)).toEqual(["uses"]);
    config.pages.push({ id: "gone", type: "markdown" });
    expect(() => loadCustomPages(config, join(c.root, "pages"))).toThrow("content/pages/gone.md doesn't exist");
  });
});

describe("posts", () => {
  test("drafts are included only when asked for", () => {
    const c = contentDir();
    c.write("posts/a.md", "---\ntitle: A\ndate: 2026-01-01\n---\n\nHi");
    c.write("posts/b.md", "---\ntitle: B\ndate: 2026-01-02\ndraft: true\n---\n\nHi");
    expect(loadPosts(join(c.root, "posts"), { drafts: false }).map((p) => p.slug)).toEqual(["a"]);
    expect(loadPosts(join(c.root, "posts"), { drafts: true }).map((p) => p.slug)).toEqual(["b", "a"]);
  });
});

describe("the committed content", () => {
  test("loads: config, posts, projects and custom pages", () => {
    const { content } = loadContent();
    expect(content.config.pages.some((p) => p.type === "projects")).toBe(true);
    expect(content.projects).toBeArray();
    expect(content.customPages).toHaveLength(content.config.pages.filter((p) => p.type === "markdown").length);
  });

  test("starter projects are valid when drafts are shown", () => {
    const { projects } = loadProjects(undefined, { drafts: true });
    expect(projects.length).toBeGreaterThan(0);
  });
});
