/**
 * The rules for site.config.json, with no Node or Bun APIs, so the build (scripts/lib/config.ts)
 * and the Studio in the browser check a config the same way.
 */
import { PAGE_ID_PATTERN, RESERVED_PAGE_IDS, V1_PAGES } from "./pages";
import { LINK_IDS, PAGE_TYPES, type SiteConfig } from "./types";

export const SCHEMA_VERSION = 2;

/** `owner/name` of a GitHub repository. */
export const REPO_PATTERN = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;

/** Thrown with every problem found, so one build run shows them all. */
export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`site.config.json is invalid:\n${problems.map((p) => `  • ${p}`).join("\n")}`);
    this.name = "ConfigError";
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Upgrades an older config to the current format, so it still builds after the code changes.
 * Each step handles one version; anything that isn't a known older version is passed through
 * for validateConfig to report.
 *   1 → 2: adds `pages`, with the four pages version 1 always had.
 */
export function migrateConfig(input: unknown): unknown {
  if (!isObj(input)) return input;
  let c: Obj = input;
  if (c.schemaVersion === 1) c = { ...c, schemaVersion: 2, pages: c.pages ?? V1_PAGES.map((p) => ({ ...p })) };
  return c;
}

/**
 * Checks a parsed site.config.json and returns it typed. Mirrors site.config.schema.json,
 * which is there for editor autocomplete; this function is what the build enforces.
 * Unknown keys are errors, so a typo can't be silently ignored.
 */
export function validateConfig(input: unknown): SiteConfig {
  const problems: string[] = [];
  const fail = (path: string, msg: string) => problems.push(`${path} ${msg}`);

  const keys = (v: Obj, path: string, required: string[], optional: string[] = []) => {
    for (const k of required) if (!(k in v)) fail(path ? `${path}.${k}` : k, "is required");
    for (const k of Object.keys(v))
      if (!required.includes(k) && !optional.includes(k)) fail(path ? `${path}.${k}` : k, "is not a known setting");
  };
  // A missing value is reported once by keys(), so the checks below skip `undefined`.
  const str = (v: unknown, path: string, { min = 1, max = 2000 } = {}): string => {
    if (v === undefined) return "";
    if (typeof v !== "string") return fail(path, "must be a string"), "";
    const len = v.trim().length;
    if (len < min) fail(path, "must not be empty");
    else if (v.length > max) fail(path, `must be at most ${max} characters`);
    return v;
  };
  const strs = (v: unknown, path: string, { minItems = 0, maxItems = 50, max = 2000 } = {}): string[] => {
    if (v === undefined) return [];
    if (!Array.isArray(v)) return fail(path, "must be a list"), [];
    if (v.length < minItems) fail(path, `must have at least ${minItems} item${minItems === 1 ? "" : "s"}`);
    if (v.length > maxItems) fail(path, `must have at most ${maxItems} items`);
    return v.map((s, i) => str(s, `${path}[${i}]`, { max }));
  };

  if (!isObj(input)) throw new ConfigError(["the file must contain a JSON object"]);
  keys(input, "", ["schemaVersion", "site", "profile", "pages"], ["$schema"]);
  if ("schemaVersion" in input && input.schemaVersion !== SCHEMA_VERSION)
    fail("schemaVersion", `must be ${SCHEMA_VERSION} (found ${JSON.stringify(input.schemaVersion)})`);

  const site = input.site;
  if (site !== undefined && !isObj(site)) fail("site", "must be an object");
  if (isObj(site)) {
    keys(site, "site", ["name", "description"], ["shareDescription", "repo"]);
    if (site.repo !== undefined && (typeof site.repo !== "string" || !REPO_PATTERN.test(site.repo)))
      fail("site.repo", 'must be a GitHub repository as "owner/name"');
    if (site.name !== undefined && (typeof site.name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,38}$/.test(site.name)))
      fail("site.name", "must be 1–39 letters, digits, '.', '_' or '-', starting with a letter or digit");
    str(site.description, "site.description", { max: 300 });
    str(site.shareDescription, "site.shareDescription", { max: 300 });
  }

  const p = input.profile;
  if (p !== undefined && !isObj(p)) fail("profile", "must be an object");
  if (isObj(p)) {
    keys(p, "profile", ["name", "handle", "title", "keywords", "bio", "skills", "photo", "links", "formspreeId"]);
    str(p.name, "profile.name", { max: 80 });
    if (p.handle !== undefined && (typeof p.handle !== "string" || !/^[a-z0-9][a-z0-9._-]{0,38}$/.test(p.handle)))
      fail("profile.handle", "must be 1–39 lowercase letters, digits, '.', '_' or '-', starting with a letter or digit");
    str(p.title, "profile.title", { max: 80 });
    strs(p.keywords, "profile.keywords", { maxItems: 12, max: 40 });
    strs(p.bio, "profile.bio", { minItems: 1, maxItems: 20 });

    if (p.skills === undefined) {
      // reported by keys()
    } else if (!Array.isArray(p.skills)) fail("profile.skills", "must be a list");
    else {
      if (p.skills.length > 20) fail("profile.skills", "must have at most 20 groups");
      p.skills.forEach((s, i) => {
        const path = `profile.skills[${i}]`;
        if (!isObj(s)) return fail(path, "must be an object with group and items");
        keys(s, path, ["group", "items"]);
        str(s.group, `${path}.group`, { max: 40 });
        strs(s.items, `${path}.items`, { maxItems: 30, max: 40 });
      });
    }

    if (p.photo === undefined) {
      // reported by keys()
    } else if (!isObj(p.photo)) fail("profile.photo", "must be an object with src and alt");
    else {
      keys(p.photo, "profile.photo", ["src", "alt"]);
      str(p.photo.alt, "profile.photo.alt", { max: 200 });
      const src = p.photo.src;
      if (src !== undefined && (typeof src !== "string" || !/^(?!\/)(?!.*\.\.)[A-Za-z0-9._/-]+\.(svg|png|jpe?g|webp)$/i.test(src)))
        fail("profile.photo.src", "must be a path from the repo root to an .svg, .png, .jpg, .jpeg or .webp file");
    }

    if (p.links === undefined) {
      // reported by keys()
    } else if (!Array.isArray(p.links)) fail("profile.links", "must be a list");
    else {
      const seen = new Set<unknown>();
      p.links.forEach((l, i) => {
        const path = `profile.links[${i}]`;
        if (!isObj(l)) return fail(path, "must be an object with id, label, display and href");
        keys(l, path, ["id", "label", "display", "href"]);
        if (!(LINK_IDS as readonly unknown[]).includes(l.id)) fail(`${path}.id`, `must be one of ${LINK_IDS.join(", ")}`);
        else if (seen.has(l.id)) fail(`${path}.id`, `"${String(l.id)}" is listed twice`);
        seen.add(l.id);
        str(l.label, `${path}.label`, { max: 40 });
        str(l.display, `${path}.display`, { max: 100 });
        const href = str(l.href, `${path}.href`, { max: 500 });
        if (href && !/^(https?:\/\/|mailto:)\S+$/i.test(href)) fail(`${path}.href`, "must start with https://, http:// or mailto:");
        else if (l.id === "email" && href && !href.startsWith("mailto:")) fail(`${path}.href`, "must start with mailto: for the email link");
      });
    }

    if (p.formspreeId !== undefined && typeof p.formspreeId !== "string") fail("profile.formspreeId", 'must be a string (use "" if you don\'t use Formspree)');
  }

  const pages = input.pages;
  if (pages === undefined) {
    // reported by keys()
  } else if (!Array.isArray(pages)) fail("pages", "must be a list");
  else {
    if (pages.length < 1 || pages.length > 20) fail("pages", "must have 1–20 pages");
    const ids = new Set<unknown>();
    const types = new Map<unknown, number>();
    pages.forEach((pg, i) => {
      const path = `pages[${i}]`;
      if (!isObj(pg)) return fail(path, "must be an object with id and type");
      keys(pg, path, ["id", "type"], ["title", "description", "hidden"]);
      if (pg.id !== undefined) {
        if (typeof pg.id !== "string" || !PAGE_ID_PATTERN.test(pg.id))
          fail(`${path}.id`, "must be 1–31 lowercase letters, digits or '-', starting with a letter or digit");
        else if ((RESERVED_PAGE_IDS as readonly string[]).includes(pg.id))
          fail(`${path}.id`, `"${pg.id}" is reserved (it's a prompt command or a planned route)`);
        else if (ids.has(pg.id)) fail(`${path}.id`, `"${pg.id}" is used by another page`);
        ids.add(pg.id);
      }
      if (pg.type !== undefined) {
        if (!(PAGE_TYPES as readonly unknown[]).includes(pg.type)) fail(`${path}.type`, `must be one of ${PAGE_TYPES.join(", ")}`);
        else if (pg.type !== "markdown" && types.has(pg.type)) fail(`${path}.type`, `only one "${String(pg.type)}" page is allowed`);
        types.set(pg.type, (types.get(pg.type) ?? 0) + 1);
      }
      str(pg.title, `${path}.title`, { max: 30 });
      str(pg.description, `${path}.description`, { max: 80 });
      if (pg.hidden !== undefined && typeof pg.hidden !== "boolean") fail(`${path}.hidden`, "must be true or false");
    });
    if (pages.length && !types.has("home")) fail("pages", 'must include a "home" page (it\'s where unknown URLs go)');
    if (pages.length && pages.every((pg) => isObj(pg) && pg.hidden === true)) fail("pages", "must have at least one page that isn't hidden");
  }

  if (problems.length) throw new ConfigError(problems);
  return input as unknown as SiteConfig;
}
