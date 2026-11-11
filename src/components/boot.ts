import { idOf, visibleEntries } from "../data/nav";
import { profile, site } from "../data/site";
import { esc } from "../lib/html";
import { prefersReducedMotion, sleep, typeText } from "../lib/motion";

const KEY = "awy-booted";

interface BootLine {
  text: string;
  cls?: string;
  typed?: boolean;
  pause?: number;
}

/**
 * One-time (per browser session) boot sequence styled like starting Claude Code.
 * Any key press or click skips it.
 */
export async function runBoot(): Promise<void> {
  let seen = false;
  try {
    seen = sessionStorage.getItem(KEY) === "1";
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* storage unavailable: just show it */
  }
  if (seen || prefersReducedMotion()) return;

  const { name } = site().config.site;
  const postCount = site().posts.length;
  const projectCount = site().projects.length;
  const postsId = idOf("posts") ?? "posts";
  // Only mention projects once the Projects page is in the tabs.
  const projectsId = visibleEntries().find((e) => e.type === "projects")?.id;
  const lines: BootLine[] = [
    { text: `$ bun run ${name}`, typed: true, pause: 220 },
    { text: `✻ Starting ${name} v1.0.0 …`, cls: "accent", pause: 260 },
    { text: `  ✓ loaded profile: ${profile().title}`, cls: "ok", pause: 140 },
    ...(projectsId
      ? [{ text: `  ✓ loaded ${projectCount} ${projectCount === 1 ? "project" : "projects"} from ${projectsId}/`, cls: "ok", pause: 140 }]
      : []),
    { text: `  ✓ loaded ${postCount} ${postCount === 1 ? "post" : "posts"} from ${postsId}/`, cls: "ok", pause: 140 },
    { text: "  ✓ snow machine online", cls: "ok", pause: 140 },
    { text: "  ✓ warp pipes connected", cls: "ok", pause: 320 },
  ];

  const overlay = document.createElement("div");
  overlay.className = "boot";
  overlay.setAttribute("role", "status");
  overlay.innerHTML = `<div class="boot-inner"></div><p class="boot-skip">press any key to skip</p>`;
  document.body.append(overlay);
  const inner = overlay.querySelector(".boot-inner")!;

  const ctrl = new AbortController();
  const skip = () => ctrl.abort();
  window.addEventListener("keydown", skip, { once: true, capture: true });
  overlay.addEventListener("pointerdown", skip, { once: true });

  for (const line of lines) {
    if (ctrl.signal.aborted) break;
    const p = document.createElement("p");
    if (line.cls) p.className = line.cls;
    inner.append(p);
    if (line.typed) await typeText(p, line.text, { cps: 40, signal: ctrl.signal });
    else p.innerHTML = esc(line.text);
    await sleep(line.pause ?? 120, ctrl.signal);
  }

  window.removeEventListener("keydown", skip, { capture: true });
  overlay.classList.add("done");
  await sleep(ctrl.signal.aborted ? 0 : 250);
  overlay.remove();
}
