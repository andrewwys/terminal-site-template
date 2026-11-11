export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });

export interface TypeOptions {
  /** Characters per second. */
  cps?: number;
  signal?: AbortSignal;
}

/**
 * Types `text` into `el` one character at a time.
 * Aborting the signal (or reduced motion) writes the full text immediately.
 */
export async function typeText(el: Element, text: string, { cps = 55, signal }: TypeOptions = {}): Promise<void> {
  if (prefersReducedMotion() || signal?.aborted) {
    el.textContent = text;
    return;
  }
  el.textContent = "";
  const delay = 1000 / cps;
  for (let i = 1; i <= text.length; i++) {
    if (signal?.aborted) break;
    el.textContent = text.slice(0, i);
    await sleep(delay * (text[i - 1] === " " ? 0.5 : 1), signal);
  }
  el.textContent = text;
}

export { sleep };
