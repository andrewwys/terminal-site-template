/**
 * Builds the homepage's winter scene: snowy pine trees and a cosy house on a
 * snowy ground, plus Santa's sleigh and reindeer that fly across the sky.
 *
 * The scene has two layers on the same 68×17 cell grid:
 *  - `glyphs`: one character per cell (trees, smoke, stars), drawn as text;
 *  - `pixels`: a solid-colour layer with two square pixels per cell
 *    (top/bottom half), drawn as rectangles (house, Santa, moon, ground).
 *
 * The hero renders both into an SVG with fixed coordinates, so the art never
 * depends on how a font sizes block or symbol characters.
 */
export type Tone =
  | "snow"
  | "flake"
  | "flake-dim"
  | "tree"
  | "tree-dark"
  | "trunk"
  | "roof"
  | "roof-dark"
  | "wall"
  | "wall-dark"
  | "window"
  | "frame"
  | "door"
  | "chimney"
  | "smoke"
  | "light-r"
  | "light-y"
  | "light-b"
  | "santa"
  | "santa-dark"
  | "fur"
  | "skin"
  | "buckle"
  | "sack"
  | "sack-dark"
  | "reindeer"
  | "antler"
  | "rein"
  | "ground-snow"
  | "soil"
  | "moon"
  | "star";

export interface Cell {
  ch: string;
  tone: Tone | null;
}

export type Grid = Cell[][];
/** `pixels[py][px]`, with `rows * 2` pixel rows. */
export type Pixels = (Tone | null)[][];

export interface Scene {
  cols: number;
  rows: number;
  glyphs: Grid;
  pixels: Pixels;
}

export const SCENE_COLS = 68;
export const SCENE_ROWS = 17;

const blank = (): Cell => ({ ch: " ", tone: null });

function put(g: Grid, x: number, y: number, ch: string, tone: Tone): void {
  const row = g[y];
  if (!row || x < 0 || x >= row.length) return;
  row[x] = { ch, tone };
}

function px(p: Pixels, x: number, y: number, tone: Tone | null): void {
  const row = p[y];
  if (!row || x < 0 || x >= row.length) return;
  row[x] = tone;
}

function rect(p: Pixels, x: number, y: number, w: number, h: number, tone: Tone): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(p, x + i, y + j, tone);
}

/** Stamps a pixel map; `.` is transparent, other letters map through `key`. */
function sprite(p: Pixels, x: number, y: number, map: readonly string[], key: Record<string, Tone>): void {
  map.forEach((line, j) => {
    [...line].forEach((ch, i) => {
      const tone = key[ch];
      if (tone) px(p, x + i, y + j, tone);
    });
  });
}

/** Pine tree centred on `cx`, `h` rows of branches, trunk sitting on row `base`. */
function tree(g: Grid, cx: number, base: number, h: number): void {
  const trunkW = h >= 6 ? 3 : 1;
  for (let i = 0; i < trunkW; i++) put(g, cx - (trunkW >> 1) + i, base, "|", "trunk");
  const bottom = base - 1;
  const top = bottom - (h - 1);
  // Snowy tip.
  put(g, cx, top - 1, "*", "snow");
  for (let r = 0; r < h; r++) {
    const y = top + r;
    const half = r + 1;
    put(g, cx - half, y, "/", "tree-dark");
    put(g, cx + half, y, "\\", "tree-dark");
    for (let x = cx - half + 1; x < cx + half; x++) {
      const j = x - cx;
      const snowy = r > 0 && ((r * 31 + j * j * 7 + h * 13 + (j < 0 ? 5 : 0)) % 9 === 0 || (r === h - 1 && Math.abs(j) % 4 === 1));
      put(g, x, y, snowy ? "*" : "^", snowy ? "snow" : "tree");
    }
  }
}

/**
 * A log-cabin style house: walls `w` pixels wide standing on pixel row
 * `floor`, a snowy 45° roof, a smoking chimney, lit windows, a door with a
 * wreath and a string of lights under the eaves.
 */
function house(p: Pixels, g: Grid, x: number, floor: number, w: number, wallH: number): void {
  const wallTop = floor - wallH + 1;
  for (let j = 0; j < wallH; j++) rect(p, x, wallTop + j, w, 1, j % 3 === 2 ? "wall-dark" : "wall");

  // Roof: overhangs 2px each side, slope of one pixel per row.
  const left = x - 2;
  const right = x + w + 1;
  const half = Math.ceil((right - left + 1) / 2);
  const eave = wallTop - 1;
  const apex = eave - half + 1;

  for (let y = apex; y <= eave; y++) {
    const k = y - apex;
    const a = left + half - 1 - k;
    const b = right - half + 1 + k;
    for (let i = a; i <= b; i++) {
      const edge = i - a < 2 || b - i < 2;
      px(p, i, y, edge || k < 2 ? "snow" : k % 2 === 0 ? "roof-dark" : "roof");
    }
  }
  // Chimney on the right slope, poking out above the roof.
  const chX = right - 5;
  const chTop = apex + 3;
  rect(p, chX, chTop, 2, 3, "chimney");
  rect(p, chX - 1, chTop - 1, 4, 1, "snow");
  const chRow = Math.floor((chTop - 1) / 2);
  put(g, chX + 1, chRow - 1, "~", "smoke");
  put(g, chX + 2, chRow - 2, "(", "smoke");
  put(g, chX + 1, chRow - 3, "~", "smoke");

  // Snow along the eave and a string of lights just below it.
  rect(p, left, eave, right - left + 1, 1, "snow");
  const lights: Tone[] = ["light-r", "light-y", "light-b"];
  for (let i = x; i < x + w; i += 2) px(p, i, wallTop, lights[(i - x) / 2 % 3]!);

  // Door with a wreath: centred between two windows when the house is wide
  // enough, otherwise beside a single window.
  const twoWindows = w >= 16;
  const doorW = 4;
  const doorX = twoWindows ? x + Math.floor((w - doorW) / 2) : x + w - doorW - 2;
  rect(p, doorX, floor - 8, doorW, 9, "door");
  px(p, doorX + doorW - 1, floor - 3, "buckle");
  sprite(p, doorX + 1, floor - 7, ["TT", "TR"], { T: "tree", R: "light-r" });

  // Two lit windows with a cross frame.
  for (const wx of twoWindows ? [x + 1, x + w - 6] : [x + 1]) {
    rect(p, wx, wallTop + 3, 5, 5, "frame");
    rect(p, wx + 1, wallTop + 4, 3, 3, "window");
    px(p, wx + 2, wallTop + 4, "frame");
    px(p, wx + 2, wallTop + 6, "frame");
    rect(p, wx + 1, wallTop + 5, 3, 1, "frame");
    rect(p, wx, wallTop + 8, 5, 1, "snow");
  }
}

/** Santa in his sleigh, facing right; the sack rides at the back. */
const SLEIGH_MAP = [
  "......rRF..",
  ".....RRR...",
  ".NN..FFFF..",
  "NNNN.SSS...",
  "NnNNFFFRR..",
  "YsssssssssY",
  ".ssssssssY.",
  "..Y....Y...",
  "YYYYYYYYYY.",
] as const;

/** One reindeer, facing right; `n` is the nose. */
const REINDEER_MAP = [
  ".....A.A",
  "......AA",
  "d....DDn",
  "DDDDDDD.",
  ".DDDDD..",
  ".D.D.D.D",
] as const;

const FLIGHT_KEY: Record<string, Tone> = {
  R: "santa",
  r: "santa-dark",
  F: "fur",
  S: "skin",
  N: "sack",
  n: "sack-dark",
  Y: "buckle",
  s: "santa-dark",
  D: "reindeer",
  d: "fur",
  A: "antler",
  L: "rein",
};

/**
 * Santa's sleigh pulled by three reindeer (Rudolph leads), as its own small
 * pixel layer that the hero flies across the sky.
 */
export function buildSleigh(): Pixels {
  const deer = 3;
  const gap = 2;
  const sleighW = SLEIGH_MAP[0].length;
  const deerW = REINDEER_MAP[0].length;
  const w = sleighW + gap + deer * (deerW + gap);
  const p: Pixels = Array.from({ length: SLEIGH_MAP.length }, () => Array.from({ length: w }, () => null));
  // Reins run from the sleigh's front to the lead reindeer.
  for (let x = sleighW; x < w - deerW + 4; x++) px(p, x, 4, "rein");
  sprite(p, 0, 0, SLEIGH_MAP, FLIGHT_KEY);
  for (let i = 0; i < deer; i++) {
    const x = sleighW + gap + i * (deerW + gap);
    sprite(p, x, 1, REINDEER_MAP, FLIGHT_KEY);
    if (i === deer - 1) px(p, x + deerW - 1, 3, "light-r"); // Rudolph's red nose
  }
  return p;
}

const MOON = [".MMM.", "MM...", "MM...", "MM...", ".MMM."] as const;

function ground(p: Pixels, cols: number, rows: number): void {
  const top = (rows - 2) * 2;
  for (let x = 0; x < cols; x++) {
    // Gentle drifts on the snow line.
    if (Math.sin(x * 0.45) + Math.sin(x * 0.17 + 1) > 1.1) px(p, x, top - 1, "snow");
    rect(p, x, top, 1, 2, "ground-snow");
    rect(p, x, top + 2, 1, 2, "soil");
  }
}

export function buildScene(cols = SCENE_COLS, rows = SCENE_ROWS): Scene {
  const glyphs: Grid = Array.from({ length: rows }, () => Array.from({ length: cols }, blank));
  const pixels: Pixels = Array.from({ length: rows * 2 }, () => Array.from({ length: cols }, () => null));
  const base = rows - 3; // last cell row above the ground
  const floor = base * 2 + 1; // last pixel row above the ground

  // Sky decorations.
  sprite(pixels, cols - 5, 1, MOON, { M: "moon" });
  for (const [x, y] of [[9, 1], [22, 0], [31, 2], [44, 0], [55, 3], [3, 4], [26, 5]] as const) {
    put(glyphs, x, y, "·", "star");
  }

  tree(glyphs, 6, base, 6);
  tree(glyphs, 17, base, 4);
  tree(glyphs, 31, base, 7);
  house(pixels, glyphs, 44, floor, 13, 12);
  tree(glyphs, 63, base, 4);

  ground(pixels, cols, rows);
  return { cols, rows, glyphs, pixels };
}

/** True when a cell holds part of the scene (flakes stop or hide there). */
export function occupied(s: Scene, x: number, y: number): boolean {
  if (s.glyphs[y]?.[x]?.tone) return true;
  return Boolean(s.pixels[y * 2]?.[x] || s.pixels[y * 2 + 1]?.[x]);
}

/** First row flakes may not enter (the snowy ground). */
export const groundRow = (rows = SCENE_ROWS): number => rows - 2;
