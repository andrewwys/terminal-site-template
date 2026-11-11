import type { Post, Project, SiteContent } from "../../src/data/types";

export const fixturePost = (over: Partial<Post> = {}): Post => ({
  slug: "first-post",
  title: "First post",
  date: "2026-01-02",
  tags: ["hello"],
  html: "<p>Hello <strong>world</strong>.</p>",
  excerpt: "Hello world.",
  ...over,
});

export const fixtureProject = (over: Partial<Project> = {}): Project => ({
  slug: "engine",
  title: "Analytical Engine",
  summary: "A general-purpose mechanical computer.",
  tags: ["brass", "steam"],
  featured: false,
  html: "",
  ...over,
});

/** A complete site that shares nothing with the real one, so leaks of real content show up. */
export const fixtureSite = (): SiteContent => ({
  config: {
    schemaVersion: 2,
    site: { name: "ada-site", description: "Ada Lovelace — Analyst." },
    profile: {
      name: "Ada Lovelace",
      handle: "ada",
      title: "Analyst",
      keywords: ["Engines", "Notes"],
      bio: ["First paragraph.", "Second paragraph."],
      skills: [{ group: "Math & Logic", items: ["Bernoulli numbers"] }],
      photo: { src: "data:image/png;base64,AAAA", alt: "Photo of Ada" },
      links: [
        { id: "github", label: "GitHub", display: "github.com/ada", href: "https://github.com/ada" },
        { id: "email", label: "Email", display: "ada@example.org", href: "mailto:ada@example.org" },
      ],
      formspreeId: "",
    },
    pages: [
      { id: "start", type: "home" },
      { id: "work", type: "projects" },
      { id: "about", type: "about", title: "Me" },
      { id: "notes", type: "posts", description: "my notebook" },
      { id: "uses", type: "markdown" },
      { id: "contact", type: "contact" },
      { id: "secret", type: "markdown", hidden: true },
    ],
  },
  posts: [
    fixturePost({ slug: "newer", title: "Newer post", date: "2026-02-01", project: "Engine" }),
    fixturePost({ project: "Notes", linkedin: "https://www.linkedin.com/feed/update/1/" }),
  ],
  projects: [
    fixtureProject({
      featured: true,
      repo: "https://github.com/ada/engine",
      demo: "https://engine.example.org",
      date: "1837-01-01",
      image: { src: "assets/c/engine-0123abcd.png", alt: "The engine" },
      html: "<p>Designed in <strong>1837</strong>.</p>",
    }),
    fixtureProject({ slug: "notes-g", title: "Note G", summary: "The first program.", tags: ["math"] }),
  ],
  customPages: [
    { id: "uses", title: "Uses", description: "tools I use", html: "<p>Pencil and paper.</p>" },
    { id: "secret", title: "Secret", command: "cat .secret", html: "<p>Hidden page.</p>" },
  ],
});
