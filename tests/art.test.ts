import { expect, test } from "bun:test";
import { PALETTE, PIXEL_MAP } from "../src/components/avatar";
import { buildScene, buildSleigh, SCENE_COLS, SCENE_ROWS } from "../src/components/scene";
import { esc, html, raw } from "../src/lib/html";

test("winter scene has a fixed size, single-character glyphs and a house", () => {
  const s = buildScene();
  expect(s.glyphs).toHaveLength(SCENE_ROWS);
  expect(s.pixels).toHaveLength(SCENE_ROWS * 2);
  for (const row of s.glyphs) {
    expect(row).toHaveLength(SCENE_COLS);
    for (const cell of row) expect([...cell.ch]).toHaveLength(1);
  }
  for (const row of s.pixels) expect(row).toHaveLength(SCENE_COLS);
  const glyphTones = new Set(s.glyphs.flat().map((c) => c.tone));
  const pixelTones = new Set(s.pixels.flat());
  for (const t of ["tree", "snow"] as const) expect(glyphTones.has(t)).toBe(true);
  for (const t of ["roof", "wall", "window", "ground-snow"] as const) expect(pixelTones.has(t)).toBe(true);
  expect(pixelTones.has("santa")).toBe(false); // Santa flies in the sky now, see buildSleigh
});

test("sleigh is a small rectangular sprite with Santa and reindeer", () => {
  const p = buildSleigh();
  expect(p.length).toBeLessThanOrEqual(10);
  for (const row of p) expect(row).toHaveLength(p[0]!.length);
  const tones = new Set(p.flat());
  for (const t of ["santa", "reindeer", "antler", "rein"] as const) expect(tones.has(t)).toBe(true);
});

test("pixel avatar is 16x16 and uses only known colours", () => {
  expect(PIXEL_MAP).toHaveLength(16);
  for (const row of PIXEL_MAP) {
    expect(row).toHaveLength(16);
    for (const ch of row) expect(PALETTE[ch]).toBeDefined();
  }
});

test("html escapes interpolations but not raw()", () => {
  expect(esc(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  expect(html`<p>${"<b>"}${raw("<i>")}${["<", raw(">")]}</p>`.value).toBe("<p>&lt;b&gt;<i>&lt;></p>");
});
