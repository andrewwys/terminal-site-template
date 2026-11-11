import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { applyCspMeta, metaCsp } from "../scripts/lib/html-meta";
import { migrateConfigFile } from "../scripts/migrate-config";
import { applyTemplate, isOwnerPath, MANIFEST, readManifest } from "../scripts/update-from-template";

/** A folder with the given files; `template.json` is written from `version` and `files`. */
function tree(files: Record<string, string>, manifest?: { version: string; files: string[] }) {
  const dir = mkdtempSync(join(tmpdir(), "tpl-"));
  const all = manifest ? { ...files, [MANIFEST]: JSON.stringify({ template: "ada/template", ...manifest }) } : files;
  for (const [rel, text] of Object.entries(all)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return dir;
}
const read = (dir: string, rel: string) => readFileSync(join(dir, rel), "utf8");

describe("update from template", () => {
  const WF = ".github/workflows/ci.yml";
  const site = () =>
    tree(
      {
        "src/app.ts": "old app",
        "src/gone.ts": "dropped by the new template",
        [WF]: "old workflow",
        "site.config.json": "my config",
        "content/posts/mine.md": "my post",
        "src/assets/portrait.ts": "my portrait",
        "README.md": "my readme",
        "notes.txt": "a file I added",
      },
      { version: "v1.0.0", files: ["src/app.ts", "src/gone.ts", WF] },
    );
  const next = () =>
    tree(
      {
        "src/app.ts": "new app",
        "src/new/feature.ts": "new file",
        [WF]: "new workflow",
        "site.config.json": "sample config",
        "content/posts/hello-world.md": "sample post",
        "README.md": "template readme",
      },
      { version: "v1.1.0", files: ["src/app.ts", "src/new/feature.ts", WF] },
    );

  test("copies the template's files, removes dropped ones and leaves the owner's alone", () => {
    const s = site();
    const summary = applyTemplate(next(), s);
    expect(summary).toEqual({ from: "v1.0.0", to: "v1.1.0", updated: ["src/app.ts", "src/new/feature.ts", WF], removed: ["src/gone.ts"], skippedWorkflows: [] });
    expect(read(s, "src/app.ts")).toBe("new app");
    expect(read(s, "src/new/feature.ts")).toBe("new file");
    expect(existsSync(join(s, "src/gone.ts"))).toBe(false);
    expect(readManifest(s)!.version).toBe("v1.1.0");
    // the owner's files
    expect(read(s, "site.config.json")).toBe("my config");
    expect(read(s, "content/posts/mine.md")).toBe("my post");
    expect(read(s, "src/assets/portrait.ts")).toBe("my portrait");
    expect(read(s, "README.md")).toBe("my readme");
    expect(read(s, "notes.txt")).toBe("a file I added");
    expect(existsSync(join(s, "content/posts/hello-world.md"))).toBe(false);
  });

  test("can leave workflow files alone and says which ones differ", () => {
    const s = site();
    const summary = applyTemplate(next(), s, { skipWorkflows: true });
    expect(summary.skippedWorkflows).toEqual([WF]);
    expect(summary.updated).toEqual(["src/app.ts", "src/new/feature.ts"]);
    expect(read(s, WF)).toBe("old workflow");
  });

  test("applying the same version again changes nothing", () => {
    const s = site();
    const n = next();
    applyTemplate(n, s);
    expect(applyTemplate(n, s)).toMatchObject({ from: "v1.1.0", updated: [], removed: [] });
  });

  test("a site without template.json still updates; nothing is removed", () => {
    const s = tree({ "src/app.ts": "old app", "src/gone.ts": "kept: not known to be the template's" });
    expect(applyTemplate(next(), s)).toMatchObject({ from: null, removed: [] });
    expect(existsSync(join(s, "src/gone.ts"))).toBe(true);
  });

  test("refuses a manifest that reaches outside the repo or into the owner's files", () => {
    for (const bad of ["../outside.ts", "/etc/passwd", ".git/config", "src/../../x", "site.config.json", "content/posts/x.md", "src/assets/portrait.ts", "README.md", MANIFEST]) {
      const n = tree({ "src/app.ts": "x" }, { version: "v2.0.0", files: [bad] });
      expect(() => applyTemplate(n, site())).toThrow(/template\.json lists/);
    }
  });

  test("owner paths", () => {
    expect(["site.config.json", "content/pages/uses.md", "src/assets/me.jpg", "README.md"].every(isOwnerPath)).toBe(true);
    expect(["src/app.ts", "site.config.schema.json", "contents.ts", "docs/README.md"].some(isOwnerPath)).toBe(false);
  });
});

describe("migrate-config", () => {
  const v2 = {
    schemaVersion: 2,
    site: { name: "ada-site", description: "Ada Lovelace — Analyst." },
    profile: {
      name: "Ada Lovelace",
      handle: "ada",
      title: "Analyst",
      keywords: ["Engines"],
      bio: ["First paragraph."],
      skills: [{ group: "Math", items: ["Bernoulli numbers"] }],
      photo: { src: "src/assets/profile-real.svg", alt: "Photo of Ada" },
      links: [{ id: "github", label: "GitHub", display: "github.com/ada", href: "https://github.com/ada" }],
      formspreeId: "",
    },
    pages: [{ id: "home", type: "home" }],
  };

  test("rewrites an older config in the current format", () => {
    const { pages, ...v1 } = { ...v2, schemaVersion: 1 };
    const dir = tree({ "site.config.json": JSON.stringify(v1) });
    const file = join(dir, "site.config.json");
    expect(migrateConfigFile(file)).toEqual({ from: 1, to: 2 });
    const saved = JSON.parse(readFileSync(file, "utf8"));
    expect(saved.schemaVersion).toBe(2);
    expect(saved.pages.map((p: { id: string }) => p.id)).toEqual(["home", "about", "posts", "contact"]);
    expect(migrateConfigFile(file)).toBeNull();
  });

  test("leaves a current config exactly as written", () => {
    const text = JSON.stringify(v2, null, 4);
    const dir = tree({ "site.config.json": text });
    expect(migrateConfigFile(join(dir, "site.config.json"))).toBeNull();
    expect(read(dir, "site.config.json")).toBe(text);
  });
});

describe("Content-Security-Policy <meta>", () => {
  const header = "default-src 'self'; script-src 'self'; img-src 'self' data:; frame-ancestors 'self' https://studio.example; report-uri /r";

  test("drops the directives a <meta> policy can't carry", () => {
    expect(metaCsp(header)).toBe("default-src 'self'; script-src 'self'; img-src 'self' data:");
  });

  test("is placed right after the charset, before anything loads, and only once", async () => {
    const page = `<!doctype html><html><head><meta charset="utf-8" /><title>t</title><link rel="stylesheet" href="a.css" /></head><body><script src="a.js"></script></body></html>`;
    const once = await applyCspMeta(page, header);
    const out = await applyCspMeta(once, header);
    expect(out.match(/http-equiv="Content-Security-Policy"/g)).toHaveLength(1);
    expect(out).toContain(`<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; img-src 'self' data:" />`);
    expect(out.indexOf("Content-Security-Policy")).toBeGreaterThan(out.indexOf("charset"));
    expect(out.indexOf("Content-Security-Policy")).toBeLessThan(out.indexOf("<title>"));
    expect(out.indexOf("Content-Security-Policy")).toBeLessThan(out.indexOf("a.css"));
  });

  test("fails without a charset to anchor to, or with an empty policy", async () => {
    await expect(applyCspMeta("<html><head></head></html>", header)).rejects.toThrow("meta[charset]");
    await expect(applyCspMeta(`<meta charset="utf-8">`, "frame-ancestors 'none'")).rejects.toThrow("empty");
  });
});
