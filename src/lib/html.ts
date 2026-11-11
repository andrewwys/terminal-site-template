const RAW = Symbol("raw");

/** A string of trusted HTML. */
export interface Raw {
  readonly [RAW]: true;
  readonly value: string;
}

export const raw = (value: string): Raw => ({ [RAW]: true, value });

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

function render(v: unknown): string {
  if (v === null || v === undefined || v === false) return "";
  if (Array.isArray(v)) return v.map(render).join("");
  if (typeof v === "object" && RAW in v) return (v as Raw).value;
  return esc(String(v));
}

/** Tagged template: interpolated values are escaped unless they are Raw (or arrays of Raw). */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Raw {
  let out = strings[0] ?? "";
  values.forEach((v, i) => {
    out += render(v) + (strings[i + 1] ?? "");
  });
  return raw(out);
}
