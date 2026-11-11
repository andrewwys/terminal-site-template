import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONFIG_FILE, ConfigError, loadConfig, MAX_PHOTO_BYTES, migrateConfig, photoDataUrl, ROOT, validateConfig } from "../scripts/lib/config";
import { RESERVED_PAGE_IDS, V1_PAGES } from "../src/data/pages";

const real = () => JSON.parse(readFileSync(CONFIG_FILE, "utf8"));

/**
 * A valid config with every setting, required and optional. The checks below change this one, not
 * the committed config, so they pass whatever the site's own config says.
 */
const sample = (): any => ({
  $schema: "./site.config.schema.json",
  schemaVersion: 2,
  site: { name: "ada-site", description: "Ada Lovelace — Analyst.", shareDescription: "Engines · Notes", repo: "ada/site" },
  profile: {
    name: "Ada Lovelace",
    handle: "ada",
    title: "Analyst",
    keywords: ["Engines", "Notes"],
    bio: ["First paragraph."],
    skills: [{ group: "Math & Logic", items: ["Bernoulli numbers"] }],
    photo: { src: "src/assets/profile-real.svg", alt: "Photo of Ada" },
    links: [
      { id: "github", label: "GitHub", display: "github.com/ada", href: "https://github.com/ada" },
      { id: "linkedin", label: "LinkedIn", display: "linkedin.com/in/ada", href: "https://www.linkedin.com/in/ada" },
      { id: "x", label: "X", display: "x.com/ada", href: "https://x.com/ada" },
      { id: "email", label: "Email", display: "ada@example.org", href: "mailto:ada@example.org" },
    ],
    formspreeId: "",
  },
  pages: [
    { id: "home", type: "home" },
    { id: "about", type: "about" },
    { id: "posts", type: "posts" },
    { id: "contact", type: "contact" },
  ],
});

/** The problems validateConfig reports for `config`, or [] if it's valid. */
const problems = (config: unknown): string[] => {
  try {
    validateConfig(config);
    return [];
  } catch (err) {
    if (err instanceof ConfigError) return err.problems;
    throw err;
  }
};

describe("site.config.json", () => {
  test("the committed config is valid and its photo is inlined", () => {
    const config = loadConfig();
    expect(config.schemaVersion).toBe(2);
    expect(config.profile.name.length).toBeGreaterThan(0);
    expect(config.profile.photo.src).toStartWith("data:image/");
  });

  test("without site.repo, a build on GitHub Actions uses the repository it runs in", () => {
    const dir = mkdtempSync(join(tmpdir(), "site-repo-"));
    mkdirSync(join(dir, "src/assets"), { recursive: true });
    writeFileSync(join(dir, "src/assets/profile-real.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
    const write = (config: unknown) => (writeFileSync(join(dir, "c.json"), JSON.stringify(config)), join(dir, "c.json"));
    const { repo, ...site } = sample().site;
    const without = write({ ...sample(), site });
    expect(loadConfig(without, dir, "alice/terminal-career-site").site.repo).toBe("alice/terminal-career-site");
    expect(loadConfig(without, dir, "").site.repo).toBeUndefined();
    expect(loadConfig(without, dir, "not a repo").site.repo).toBeUndefined();
    expect(loadConfig(write(sample()), dir, "alice/other").site.repo).toBe(repo);
  });

  test("the JSON Schema lists the same settings the build checks", () => {
    const schema = JSON.parse(readFileSync(join(ROOT, "site.config.schema.json"), "utf8"));
    const config = sample();
    expect(Object.keys(schema.properties).sort()).toEqual(Object.keys(config).sort());
    expect(schema.properties.profile.required.sort()).toEqual(Object.keys(config.profile).sort());
    const site = schema.properties.site;
    expect(Object.keys(site.properties).sort()).toEqual(Object.keys(config.site).sort());
    expect(schema.properties.schemaVersion.const).toBe(config.schemaVersion);
    const page = schema.properties.pages.items;
    expect(Object.keys(page.properties).sort()).toEqual(["description", "hidden", "id", "title", "type"]);
    expect(page.properties.id.not.enum).toEqual([...RESERVED_PAGE_IDS]);
  });
});

describe("validateConfig", () => {
  test("accepts the committed config and the sample", () => {
    expect(problems(real())).toEqual([]);
    expect(problems(sample())).toEqual([]);
  });

  test("reports every problem at once, with its path", () => {
    const c = sample();
    delete c.profile.name;
    c.profile.handle = "Ada Lovelace";
    c.profile.bio = [];
    c.profile.links[0].href = "javascript:alert(1)";
    c.profile.links[3].href = "https://example.com";
    c.profile.links.push({ ...c.profile.links[0], href: "https://github.com/x" });
    c.profile.skills[0].items = "AWS";
    c.site.name = "has spaces";
    delete c.site.description;
    expect(problems(c)).toEqual([
      "site.description is required",
      expect.stringMatching(/^site\.name must be/),
      "profile.name is required",
      expect.stringMatching(/^profile\.handle must be/),
      "profile.bio must have at least 1 item",
      "profile.skills[0].items must be a list",
      "profile.links[0].href must start with https://, http:// or mailto:",
      "profile.links[3].href must start with mailto: for the email link",
      'profile.links[4].id "github" is listed twice',
    ]);
  });

  test("rejects unknown settings, so typos aren't silently ignored", () => {
    const c = sample();
    c.profile.titel = "typo";
    c.theme = {};
    c.site.descripton = "typo";
    expect(problems(c)).toEqual([
      "theme is not a known setting",
      "site.descripton is not a known setting",
      "profile.titel is not a known setting",
    ]);
  });

  test("rejects other schema versions and non-objects", () => {
    expect(problems({ ...sample(), schemaVersion: 3 })).toEqual(["schemaVersion must be 2 (found 3)"]);
    expect(problems([])).toEqual(["the file must contain a JSON object"]);
  });

  test("photo paths must be image files inside the repo", () => {
    for (const src of ["/etc/passwd.png", "../outside.png", "photo.gif", "src/assets/x.svg?y"]) {
      const c = sample();
      c.profile.photo.src = src;
      expect(problems(c)).toEqual([expect.stringMatching(/^profile\.photo\.src must be/)]);
    }
  });
});

describe("photo", () => {
  const dir = mkdtempSync(join(tmpdir(), "site-config-"));
  mkdirSync(join(dir, "img"));

  test("is inlined as a data: URL with the right type", () => {
    writeFileSync(join(dir, "img/me.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
    expect(photoDataUrl("img/me.jpg", dir)).toBe("data:image/jpeg;base64,/9j/");
  });

  test("must exist and stay under the size limit", () => {
    expect(() => photoDataUrl("img/missing.png", dir)).toThrow("no file at img/missing.png");
    writeFileSync(join(dir, "img/big.png"), Buffer.alloc(MAX_PHOTO_BYTES + 1));
    expect(() => photoDataUrl("img/big.png", dir)).toThrow("the limit is 512 KB");
  });

  test("loadConfig fails clearly on invalid JSON", () => {
    const file = join(dir, "broken.json");
    writeFileSync(file, "{ nope");
    expect(() => loadConfig(file, dir)).toThrow("is not valid JSON");
  });
});

describe("migrateConfig", () => {
  test("a version 1 config gets the four pages it always had", () => {
    const { pages, ...rest } = sample();
    const v1 = { ...rest, schemaVersion: 1 };
    const migrated = migrateConfig(v1) as Record<string, unknown>;
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.pages).toEqual(V1_PAGES);
    expect(problems(migrated)).toEqual([]);
    expect(v1).not.toHaveProperty("pages"); // the input isn't changed
    expect(pages).toBeArray();
  });

  test("current and unknown versions pass through for validation", () => {
    const c = sample();
    expect(migrateConfig(c)).toBe(c);
    expect(migrateConfig("nope")).toBe("nope");
  });
});

describe("pages", () => {
  const withPages = (pages: unknown) => problems({ ...sample(), pages });

  test("the committed pages are valid", () => {
    expect(withPages(sample().pages)).toEqual([]);
  });

  test("ids must be well-formed, unique and not reserved", () => {
    expect(
      withPages([
        { id: "home", type: "home" },
        { id: "Uses Page", type: "markdown" },
        { id: "help", type: "markdown" },
        { id: "home", type: "markdown" },
      ]),
    ).toEqual([
      expect.stringMatching(/^pages\[1\]\.id must be/),
      'pages[2].id "help" is reserved (it\'s a prompt command or a planned route)',
      'pages[3].id "home" is used by another page',
    ]);
  });

  test("types are known, built-ins appear once, and there's a home page", () => {
    expect(withPages([{ id: "a", type: "posts" }, { id: "b", type: "posts" }, { id: "c", type: "gallery" }])).toEqual([
      'pages[1].type only one "posts" page is allowed',
      "pages[2].type must be one of home, about, projects, posts, contact, markdown",
      'pages must include a "home" page (it\'s where unknown URLs go)',
    ]);
    expect(withPages([{ id: "home", type: "home" }, { id: "a", type: "markdown" }, { id: "b", type: "markdown" }])).toEqual([]);
  });

  test("optional fields are checked, unknown ones rejected, and something stays visible", () => {
    expect(
      withPages([
        { id: "home", type: "home", hidden: "yes", title: "", colour: "red" },
        { id: "x", type: "markdown", hidden: true, description: "d".repeat(81) },
      ]),
    ).toEqual([
      "pages[0].colour is not a known setting",
      "pages[0].title must not be empty",
      "pages[0].hidden must be true or false",
      "pages[1].description must be at most 80 characters",
    ]);
    expect(withPages([{ id: "home", type: "home", hidden: true }])).toEqual(["pages must have at least one page that isn't hidden"]);
    expect(withPages([])).toEqual(["pages must have 1–20 pages"]);
  });
});
