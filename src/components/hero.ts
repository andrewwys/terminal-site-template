import { esc, html, raw, type Raw } from "../lib/html";
import { prefersReducedMotion } from "../lib/motion";
import { buildScene, buildSleigh, groundRow, occupied, SCENE_COLS, SCENE_ROWS, type Grid, type Pixels, type Scene, type Tone } from "./scene";

interface Flake {
  x: number;
  y: number;
  speed: number;
  phase: number;
  ch: string;
  tone: Tone;
}

const FLAKE_CHARS = ["*", "*", "·", "+", "•"];

// Small deterministic PRNG so the static (reduced-motion) frame is stable.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function makeFlake(rand: () => number, anywhere: boolean): Flake {
  const ch = FLAKE_CHARS[Math.floor(rand() * FLAKE_CHARS.length)]!;
  return {
    x: rand() * SCENE_COLS,
    y: anywhere ? rand() * (groundRow() - 1) : -rand() * 3,
    speed: 0.12 + rand() * 0.3,
    phase: rand() * Math.PI * 2,
    ch,
    tone: ch === "·" || ch === "+" ? "flake-dim" : "flake",
  };
}

/** Cell size in SVG units: two square 10×10 pixels per cell. */
const CW = 10;
const CH = 20;
const VIEW_W = SCENE_COLS * CW;
const VIEW_H = SCENE_ROWS * CH;

/** Solid layer as one rect per horizontal run of a colour. */
function pixelsSvg(pixels: Pixels): string {
  let out = "";
  pixels.forEach((row, py) => {
    let x = 0;
    while (x < row.length) {
      const tone = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === tone) end++;
      if (tone) out += `<rect class="t-${tone}" x="${x * CW}" y="${py * (CH / 2)}" width="${(end - x) * CW}" height="${CH / 2}"/>`;
      x = end;
    }
  });
  return out;
}

/** Every glyph is placed at its own cell centre, so font metrics can't skew rows. */
function glyphsSvg(grid: Grid): string {
  let out = "";
  grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell.tone || cell.ch === " ") return;
      out += `<text class="t-${cell.tone}" x="${x * CW + CW / 2}" y="${y * CH + CH / 2}">${esc(cell.ch)}</text>`;
    });
  });
  return out;
}

/** Sleigh pixels are drawn at about a third of the size so it reads as far away in the sky. */
const SLEIGH = pixelsSvg(buildSleigh());

function svgInner(scene: Scene): string {
  return (
    `<g shape-rendering="crispEdges">${pixelsSvg(scene.pixels)}</g>` +
    `<g class="hero-sleigh" shape-rendering="crispEdges"><g transform="translate(0 16) scale(0.35)">${SLEIGH}</g></g>` +
    `<g class="hero-glyphs">${glyphsSvg(scene.glyphs)}</g>`
  );
}

export function heroMarkup(): Raw {
  const scene = buildScene();
  return html`<figure class="hero" aria-label="Pixel art: snow falling on pine trees, a cosy house, and Santa flying his sleigh and reindeer across the sky">
    <svg class="hero-art" viewBox="0 0 ${VIEW_W} ${VIEW_H}" aria-hidden="true">${raw(svgInner(scene))}</svg>
  </figure>`;
}

/** Starts the falling-snow animation. Returns a cleanup function. */
export function mountHero(root: HTMLElement): () => void {
  // Only the glyph layer changes per frame; the sleigh's CSS flight keeps running.
  const layer = root.querySelector<SVGGElement>(".hero-art .hero-glyphs");
  if (!layer) return () => {};

  const scene = buildScene();
  const floor = groundRow();
  const rand = rng(7);
  const flakes = Array.from({ length: 34 }, () => makeFlake(rand, true));
  let t = 0;

  const frame = () => {
    const grid: Grid = scene.glyphs.map((row) => row.slice());
    for (const f of flakes) {
      const x = Math.round(f.x + Math.sin(t * 0.15 + f.phase) * 1.2);
      const y = Math.round(f.y);
      const cell = grid[y]?.[x];
      if (cell && cell.tone === null && !occupied(scene, x, y)) grid[y]![x] = { ch: f.ch, tone: f.tone };
    }
    layer.innerHTML = glyphsSvg(grid);
  };

  const step = () => {
    t++;
    for (const [i, f] of flakes.entries()) {
      f.y += f.speed;
      const x = Math.round(f.x + Math.sin(t * 0.15 + f.phase) * 1.2);
      const y = Math.round(f.y);
      const below = scene.glyphs[y]?.[x];
      const landed = f.y > 1 && below?.tone !== "star" && occupied(scene, x, y);
      // Melt into the ground or land on a tree/the house/Santa, then respawn at the top.
      if (f.y >= floor || landed) {
        flakes[i] = makeFlake(rand, false);
      }
    }
    frame();
  };

  frame();
  if (prefersReducedMotion()) return () => {};

  let raf = 0;
  let last = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (document.hidden || now - last < 110) return;
    last = now;
    step();
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}

export { SCENE_COLS, SCENE_ROWS };
