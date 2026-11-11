import { PALETTE, PIXEL_MAP } from "../assets/portrait";
import { html, raw, type Raw } from "../lib/html";

export { PALETTE, PIXEL_MAP };

export function pixelAvatarSvg(): string {
  const rects: string[] = [];
  PIXEL_MAP.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${PALETTE[ch] ?? PALETTE["."]}"/>`);
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${rects.join("")}</svg>`;
}

/** 8-bit portrait that reveals the real photo on hover, focus/selection or tap. */
export function avatarMarkup(realSrc: string, alt: string): Raw {
  return html`<button type="button" class="avatar" data-nav aria-pressed="false"
      aria-label="Profile picture: 8-bit version. Hover, select or press Enter to show the real photo.">
    <span class="avatar-frame">
      <span class="avatar-pixel">${raw(pixelAvatarSvg())}</span>
      <img class="avatar-real" src="${realSrc}" alt="${alt}" loading="lazy" decoding="async" />
    </span>
    <span class="avatar-caption"><span class="when-pixel">8-bit mode · hover or select</span><span class="when-real">real-life mode</span></span>
  </button>`;
}

export function mountAvatar(root: HTMLElement): void {
  const btn = root.querySelector<HTMLButtonElement>(".avatar");
  btn?.addEventListener("click", () => {
    btn.setAttribute("aria-pressed", String(btn.getAttribute("aria-pressed") !== "true"));
  });
}
