import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { excerpt, fromSharing, loadPosts, parsePost, renderMarkdown, safeHref, stripHashtagLine } from "../scripts/lib/posts";

const SITE_POST = `---
title: "The monthly dice hand"
date: 2026-11-04
project: Rich World
tags: [gamedesign, boardgames]
linkedin: https://www.linkedin.com/feed/update/urn:li:share:1/
---

In Rich World, you don't roll dice on your turn.

Each month you're dealt **4** dice.
`;

describe("renderMarkdown", () => {
  test("escapes raw HTML instead of rendering it", () => {
    const out = renderMarkdown("<script>alert(1)</script>\n\nhi <img src=x onerror=alert(1)>");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;");
  });

  test("drops unsafe link targets and hardens links", () => {
    const out = renderMarkdown("[a](javascript:alert(1)) [b](https://example.com) [c](#/about)");
    expect(out).toContain('href="#" rel="noopener noreferrer"');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('href="#/about"');
    expect(out).not.toContain("javascript:");
  });

  test("safeHref", () => {
    expect(safeHref("data:text/html,x")).toBe("#");
    expect(safeHref("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(safeHref("./img.png")).toBe("./img.png");
  });
});

describe("parsePost", () => {
  test("reads front matter and renders the body", () => {
    const p = parsePost(SITE_POST, "2026-11-04-monthly-dice-hand")!;
    expect(p).toMatchObject({
      slug: "2026-11-04-monthly-dice-hand",
      title: "The monthly dice hand",
      date: "2026-11-04",
      project: "Rich World",
      tags: ["gamedesign", "boardgames"],
      linkedin: "https://www.linkedin.com/feed/update/urn:li:share:1/",
      excerpt: "In Rich World, you don't roll dice on your turn.",
    });
    expect(p.html).toContain("<strong>4</strong>");
  });

  test("skips drafts, rejects a missing title or date, ignores a non-http LinkedIn link", () => {
    expect(parsePost(SITE_POST.replace("---\n\n", "draft: true\n---\n\n"), "d")).toBeNull();
    expect(() => parsePost(SITE_POST.replace(/title:.*\n/, ""), "t")).toThrow(/missing title/);
    expect(() => parsePost(SITE_POST.replace("date: 2026-11-04", "date: soon"), "t")).toThrow(/date/);
    expect(parsePost(SITE_POST.replace(/linkedin: .*/, "linkedin: javascript:x"), "t")!.linkedin).toBeUndefined();
  });

  test("excerpt is plain text and cut", () => {
    expect(excerpt("<p>a &amp; <em>b</em></p><p>c</p>")).toBe("a & b");
    expect(excerpt(`<p>${"x".repeat(300)}</p>`, 10)).toBe(`${"x".repeat(9)}…`);
  });
});

describe("loadPosts", () => {
  test("reads a folder, newest first, without drafts", () => {
    const dir = mkdtempSync(join(tmpdir(), "posts-"));
    writeFileSync(join(dir, "a.md"), SITE_POST);
    writeFileSync(join(dir, "b.md"), SITE_POST.replace("2026-11-04", "2026-12-01"));
    writeFileSync(join(dir, "c.md"), SITE_POST.replace("---\n\n", "draft: true\n---\n\n"));
    writeFileSync(join(dir, ".gitkeep"), "");
    expect(loadPosts(dir).map((p) => p.slug)).toEqual(["b", "a"]);
    expect(loadPosts(join(dir, "missing"))).toEqual([]);
  });
});

describe("fromSharing", () => {
  const SHARING = `---
status: Posted
created: 2026-11-03
tags: [gamedesign, boardgames]
sources:
  - "PLAN.md §3"
review_notes:
linkedin_url: https://www.linkedin.com/feed/update/urn:li:share:9/
posted_at: 2026-11-05T01:30:00.000Z
---

# The monthly dice hand

## LinkedIn

In Rich World, you don't roll dice on your turn.

Would you play it this way?

#GameDesign #BoardGames

## Notes

private
`;

  test("converts a Posted Sharing post into a site post", () => {
    const out = fromSharing(SHARING, "/x/Sharing/posts/2026-11-03-monthly-dice-hand.md");
    expect(out.slug).toBe("2026-11-03-monthly-dice-hand");
    expect(out.status).toBe("Posted");
    const post = parsePost(out.markdown!, out.slug)!;
    expect(post).toMatchObject({
      title: "The monthly dice hand",
      date: "2026-11-05",
      project: "Rich World",
      tags: ["gamedesign", "boardgames"],
      linkedin: "https://www.linkedin.com/feed/update/urn:li:share:9/",
    });
    expect(out.markdown).not.toContain("#GameDesign");
    expect(out.markdown).not.toContain("private");
    expect(out.markdown).toContain("source: rich-world-godot/Sharing/posts/2026-11-03-monthly-dice-hand.md");
  });

  test("an unposted draft falls back to its created date and has no link", () => {
    const draft = SHARING.replace("status: Posted", "status: New").replace(/linkedin_url: .*\nposted_at: .*\n/, "linkedin_url:\nposted_at:\n");
    const post = parsePost(fromSharing(draft, "d.md").markdown!, "d")!;
    expect(post.date).toBe("2026-11-03");
    expect(post.linkedin).toBeUndefined();
  });

  test("no LinkedIn section → nothing to copy", () => {
    expect(fromSharing(SHARING.replace("## LinkedIn", "## Draft"), "d.md").markdown).toBeNull();
  });

  test("stripHashtagLine keeps hashtags inside the text", () => {
    expect(stripHashtagLine("I use #Godot daily.\n\n#GameDev #Godot")).toBe("I use #Godot daily.");
    expect(stripHashtagLine("No tags here.")).toBe("No tags here.");
  });
});
