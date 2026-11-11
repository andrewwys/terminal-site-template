import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, ROOT } from "../scripts/lib/config";
import { applyPageMeta } from "../scripts/lib/html-meta";
import { contactEmail, firstName, formspreeConfigured, setSite } from "../src/data/site";
import { about } from "../src/pages/about";
import { contact } from "../src/pages/contact";
import { home } from "../src/pages/home";
import { homeId, navEntries, stepFrom, tabsMarkup, visibleEntries } from "../src/data/nav";
import { pageFor } from "../src/pages";
import { createMarkdownPage } from "../src/pages/markdown";
import { createPostsPage } from "../src/pages/posts";
import { createProjectsPage } from "../src/pages/projects";
import { fixtureSite } from "./fixtures/site";

const postsPage = createPostsPage("notes");
const projectsPage = createProjectsPage("work");

const real = loadConfig();
/** Words from the real config that must never appear in another site's pages. */
const REAL_WORDS = [real.profile.name, real.profile.handle, real.profile.title, real.site.name, ...real.profile.keywords];

const expectNoRealContent = (out: string) => {
  for (const w of REAL_WORDS) expect(out).not.toContain(w);
};

beforeEach(() => setSite(fixtureSite()));

describe("pages render from the site content they're given", () => {
  test("home, with a menu of the visible pages in tab order", () => {
    const out = home.render().value;
    for (const s of ["Ada Lovelace", "Analyst", "~/ada", "Engines", "Notes"]) expect(out).toContain(s);
    const menu = [...out.matchAll(/href="#\/([^"]+)"[\s\S]*?class="label">([^<]+)<\/span> <span class="dim">— ([^<]+)</g)].map((m) => m.slice(1));
    expect(menu).toEqual([
      ["work", "Projects", "things I&#39;ve built"], // escaped in the HTML
      ["about", "Me", "who I am, what I work with"],
      ["notes", "Posts", "my notebook"],
      ["uses", "Uses", "tools I use"],
      ["contact", "Contact", "say hello"],
    ]);
    expectNoRealContent(out);
  });

  test("about", () => {
    const out = about.render().value;
    for (const s of ["First paragraph.", "Second paragraph.", "math-logic/", "Bernoulli numbers", 'alt="Photo of Ada"'])
      expect(out).toContain(s);
    expect(out).toContain("data:image/png;base64,AAAA");
    expectNoRealContent(out);
  });

  test("contact", () => {
    const out = contact.render().value;
    for (const s of ["github.com/ada", "mailto:ada@example.org", 'placeholder="Hi Ada, …"']) expect(out).toContain(s);
    expectNoRealContent(out);
  });

  test("posts list and a post", () => {
    const list = postsPage.render().value;
    expect(list).toContain("Found <strong class=\"fg\">2</strong> posts");
    expect(list).toContain('data-filter="Engine"'); // two projects → filters appear
    const post = postsPage.render("first-post").value;
    expect(post).toContain("Hello <strong>world</strong>.");
    expect(post).toContain("View on LinkedIn");
    expect(post).toContain('href="#/notes/newer"'); // links use the page's id from the config
    expect(post).toContain('href="#/notes"');
    expect(postsPage.command).toBeFunction();
    expect((postsPage.command as (s?: string) => string)("first-post")).toBe("cat notes/first-post.md");
    expect(postsPage.pageTitle?.("newer")).toBe("Newer post");
    expect(postsPage.render("missing").value).toContain("No such file or directory");
    expectNoRealContent(list + post);
  });

  test("content is HTML-escaped", () => {
    const s = fixtureSite();
    s.config.profile.name = '<img src=x onerror="alert(1)">';
    s.config.profile.bio = ["<script>alert(1)</script>"];
    setSite(s);
    const out = home.render().value + about.render().value;
    expect(out).not.toContain("<img src=x");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  test("switching content switches what renders", () => {
    expect(home.render().value).toContain("Ada Lovelace");
    const s = fixtureSite();
    s.config.profile.name = "Grace Hopper";
    s.posts = [];
    setSite(s);
    expect(home.render().value).toContain("Grace Hopper");
    expect(postsPage.render().value).toContain("No posts yet");
  });
});

describe("projects", () => {
  test("list: projects in build order, with featured mark, image and filters by tag", () => {
    const out = projectsPage.render().value;
    expect(out).toContain('Found <strong class="fg">2</strong> projects');
    expect(out.indexOf("Analytical Engine")).toBeLessThan(out.indexOf("Note G"));
    expect(out).toContain("★ featured");
    expect(out).toContain('src="assets/c/engine-0123abcd.png"');
    expect(out).toContain('href="#/work/engine"');
    expect([...out.matchAll(/data-filter="([^"]*)"/g)].map((m) => m[1])).toEqual(["", "brass", "math", "steam"]);
    expect(out).toContain('data-tags="brass steam"');
    expectNoRealContent(out);
  });

  test("a project's page: summary, image with alt text, links, body and neighbours", () => {
    const out = projectsPage.render("engine").value;
    for (const s of [
      "A general-purpose mechanical computer.",
      'alt="The engine"',
      'href="https://github.com/ada/engine"',
      'href="https://engine.example.org"',
      "Designed in <strong>1837</strong>.",
      'href="#/work/notes-g"',
      'href="#/work"',
    ])
      expect(out).toContain(s);
    const plain = projectsPage.render("notes-g").value;
    expect(plain).not.toContain("<img");
    expect(plain).not.toContain("Source ↗");
    expect(projectsPage.pageTitle?.("notes-g")).toBe("Note G");
    expect(projectsPage.render("nope").value).toContain("cat: work/nope.md: No such file or directory");
  });

  test("no projects yet", () => {
    setSite({ ...fixtureSite(), projects: [] });
    expect(projectsPage.render().value).toContain("No projects yet");
  });
});

describe("custom pages", () => {
  test("render their Markdown and use their own command", () => {
    const uses = createMarkdownPage("uses");
    expect(uses.render().value).toContain("Pencil and paper.");
    expect((uses.command as () => string)()).toBe("cat uses.md");
    expect((createMarkdownPage("secret").command as () => string)()).toBe("cat .secret");
    expect(createMarkdownPage("gone").render().value).toContain("No such file or directory");
  });
});

describe("navigation from config.pages", () => {
  test("titles and help text come from the config, the page type or the custom page", () => {
    expect(navEntries().map((e) => [e.id, e.title, e.help, e.hidden])).toEqual([
      ["start", "Home", "go to the home page", false],
      ["work", "Projects", "things I've built", false],
      ["about", "Me", "who I am", false],
      ["notes", "Posts", "my notebook", false],
      ["uses", "Uses", "tools I use", false],
      ["contact", "Contact", "get in touch", false],
      ["secret", "Secret", "read secret.md", true],
    ]);
    expect(homeId()).toBe("start");
  });

  test("hidden pages have no tab; tabs get number keys in order", () => {
    expect(visibleEntries().map((e) => e.id)).not.toContain("secret");
    expect(tabsMarkup()).toBe(
      [
        ["start", "Home"],
        ["work", "Projects"],
        ["about", "Me"],
        ["notes", "Posts"],
        ["uses", "Uses"],
        ["contact", "Contact"],
      ]
        .map(([id, t], i) => `<a href="#/${id}" data-route="${id}"><span class="key" aria-hidden="true">${i + 1}</span>${t}</a>`)
        .join(""),
    );
  });

  test("only the first nine tabs get number keys, and titles are escaped", () => {
    const s = fixtureSite();
    s.config.pages = [
      { id: "home", type: "home", title: "<b>Home</b>" },
      ...Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, type: "markdown" as const, title: `P${i}` })),
    ];
    const tabs = tabsMarkup(s);
    expect(tabs.match(/class="key"/g)).toHaveLength(9);
    expect(tabs).toContain("&lt;b&gt;Home&lt;/b&gt;");
  });

  test("left and right step through visible pages and wrap; from a hidden page they start at Home", () => {
    expect(stepFrom("start", 1)).toBe("work");
    expect(stepFrom("start", -1)).toBe("contact");
    expect(stepFrom("contact", 1)).toBe("start");
    expect(stepFrom("secret", 1)).toBe("work");
  });

  test("pageFor uses the config's id and title", () => {
    const entry = navEntries().find((e) => e.id === "about")!;
    const page = pageFor(entry);
    expect(page.id).toBe("about");
    expect(page.title).toBe("Me");
  });
});

describe("profile helpers", () => {
  test("first name, contact email and Formspree check", () => {
    expect(firstName()).toBe("Ada");
    expect(contactEmail()).toBe("ada@example.org");
    expect(formspreeConfigured()).toBe(false);
    const s = fixtureSite();
    s.config.profile.formspreeId = "abcd1234";
    expect(formspreeConfigured(s.config.profile)).toBe(true);
  });
});

describe("index.html head and title bar", () => {
  const source = readFileSync(join(ROOT, "index.html"), "utf8");

  test("are filled from the config, with nothing left from the real site", async () => {
    const out = await applyPageMeta(source, fixtureSite());
    expect(out).toContain("<title>Ada Lovelace — Analyst</title>");
    expect(out).toContain(`<nav id="tabs" class="tabs" aria-label="Pages">${tabsMarkup(fixtureSite())}</nav>`);
    expect(out).toContain('<meta name="description" content="Ada Lovelace — Analyst." />');
    expect(out).toContain('<meta property="og:title" content="Ada Lovelace — Analyst" />');
    expect(out).toContain('<meta property="og:description" content="Ada Lovelace — Analyst." />'); // falls back to description
    expect(out).toContain('<span id="site-name">ada-site</span>');
    expect(out).toContain('<span id="status-title">Analyst</span>');
    expectNoRealContent(out);
  });

  test("values are escaped", async () => {
    const c = fixtureSite();
    c.config.profile.name = 'A "quoted" <name>';
    const out = await applyPageMeta(source, c);
    // Text can't open a tag, and an attribute value can't close its quotes.
    expect(out).toContain('<title>A "quoted" &lt;name&gt; — Analyst</title>');
    expect(out).toContain('content="A &quot;quoted&quot; <name> — Analyst"');
  });

  test("a missing tag fails the build instead of shipping the wrong name", async () => {
    await expect(applyPageMeta(source.replace(/<meta property="og:title"[^>]*>/, ""), fixtureSite())).rejects.toThrow(
      'index.html is missing: meta[property="og:title"]',
    );
  });
});
