/** `site.config.json`: everything personal about the site. Checked at build time by `scripts/lib/config.ts`. */
export interface SiteConfig {
  schemaVersion: 2;
  site: SiteMeta;
  profile: Profile;
  /** The site's pages, in tab order. */
  pages: PageEntry[];
}

/** Built-in page types, plus `markdown` for a custom page from content/pages/<id>.md. */
export const PAGE_TYPES = ["home", "about", "projects", "posts", "contact", "markdown"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

/** One page in site.config.json's `pages` list. */
export interface PageEntry {
  /** The page's URL (`#/<id>`) and prompt command (`/<id>`). */
  id: string;
  type: PageType;
  /** Tab label. Defaults to the page type's own (e.g. "Projects"), or a custom page's front matter title. */
  title?: string;
  /** Shown in `help` and the Home menu. Defaults to the page type's own. */
  description?: string;
  /** Left out of the tabs, number keys, Home menu, `help` and `ls`, but still reachable at its URL. */
  hidden?: boolean;
}

/** About the site itself, rather than its owner. */
export interface SiteMeta {
  /** Short name shown in the title bar and boot sequence, e.g. "andrew-wy". */
  name: string;
  /** For search engines: the page's `<meta name="description">`. */
  description: string;
  /** For link previews (`og:description`). Defaults to `description`. */
  shareDescription?: string;
  /** The site's GitHub repository, "owner/name". `/edit` opens it in the Studio. */
  repo?: string;
}

/** Everything a site renders from: the config plus its Markdown content. */
export interface SiteContent {
  config: SiteConfig;
  posts: Post[];
  projects: Project[];
  /** Custom pages, one per `markdown` entry in `config.pages`. */
  customPages: CustomPage[];
}

/** A portfolio project, built from one Markdown file in `content/projects/`. */
export interface Project {
  /** File name without `.md`; the project lives at `#/projects/<slug>`. */
  slug: string;
  title: string;
  /** One or two sentences for the list. */
  summary: string;
  /** Technologies, used for the filters. */
  tags: string[];
  repo?: string;
  demo?: string;
  /** YYYY-MM-DD. */
  date?: string;
  /** Featured projects come first and are marked. */
  featured: boolean;
  /** Lower comes first, after featured. Projects without one follow, newest first. */
  order?: number;
  /** `src` is the built, content-hashed URL, e.g. `assets/c/rich-world-1a2b3c4d.png`. */
  image?: { src: string; alt: string };
  /** The optional body, rendered to HTML at build time, for the project's own page. */
  html: string;
}

/** A custom page, built from content/pages/<id>.md. */
export interface CustomPage {
  id: string;
  title: string;
  /** The line "typed" at the top of the page. Defaults to `cat <id>.md`. */
  command?: string;
  /** Shown in `help` and the Home menu, unless the config sets one. */
  description?: string;
  html: string;
}

export interface Profile {
  name: string;
  /** Short lowercase id, shown as the home directory (`~/handle`). */
  handle: string;
  title: string;
  keywords: string[];
  /** Each string is one paragraph. */
  bio: string[];
  skills: SkillGroup[];
  photo: {
    /** In the config: a path from the repo root. In the bundle: a `data:` URL of that file. */
    src: string;
    alt: string;
  };
  links: SocialLink[];
  /** Formspree form ID (the part after https://formspree.io/f/). */
  formspreeId: string;
}

export const LINK_IDS = ["github", "linkedin", "x", "email"] as const;

export interface SocialLink {
  id: (typeof LINK_IDS)[number];
  label: string;
  /** Text shown to visitors. */
  display: string;
  href: string;
}

export interface SkillGroup {
  group: string;
  items: string[];
}

/** A post on the site, built from one Markdown file in `content/posts/`. */
export interface Post {
  /** File name without `.md`; the post lives at `#/posts/<slug>`. */
  slug: string;
  title: string;
  /** YYYY-MM-DD. */
  date: string;
  /** The project the post is about, e.g. "Rich World". */
  project?: string;
  tags: string[];
  /** The same post on LinkedIn, if it was posted there. */
  linkedin?: string;
  /** Body rendered to HTML at build time (raw HTML in the Markdown is escaped). */
  html: string;
  /** Plain-text start of the body, for the list. */
  excerpt: string;
}
