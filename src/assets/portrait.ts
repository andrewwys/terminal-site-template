/**
 * 16×16 pixel-art portrait, shown on the About page until the visitor hovers or selects it.
 * Each character is one pixel, and PALETTE gives each character its colour:
 *   .=background  h=hair  s=skin  S=skin shadow  e=eye  m=mouth  o=top  O=top shade
 * Redraw the map to look like you. Rows must stay 16 characters wide, 16 rows.
 */
export const PIXEL_MAP = [
  "................",
  ".....hhhhhh.....",
  "....hhhhhhhh....",
  "...hhhhhhhhhh...",
  "...hhsssssshh...",
  "...hsssssssshh..",
  "...ssssssssss...",
  "...ssessssess...",
  "...ssssssssss...",
  "...ssssSSssss...",
  "....ssmmmmss....",
  ".....ssssss.....",
  "......SssS......",
  "...ooooOOoooo...",
  "..ooooooOOoooo..",
  ".oooooooooooooo.",
] as const;

export const PALETTE: Record<string, string> = {
  ".": "#1d2433",
  h: "#3a3a44",
  s: "#e0b48c",
  S: "#c4946a",
  e: "#1a1a1a",
  m: "#a0473a",
  o: "#5b8def",
  O: "#3f6fd1",
};
