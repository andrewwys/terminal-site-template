import { tabsMarkup } from "../../src/data/nav";
import type { SiteContent } from "../../src/data/types";

/**
 * The parts of index.html that come from site.config.json. They must be in the HTML itself,
 * not only set by script, because search engines and link previews (LinkedIn, Slack, …) read
 * the page without running it. app.ts sets the visible ones again at runtime for `bun run dev`.
 */
export function pageMeta(content: SiteContent) {
  const { site, profile } = content.config;
  const title = `${profile.name} — ${profile.title}`;
  return {
    title: { selector: "title", text: title },
    description: { selector: 'meta[name="description"]', attr: site.description },
    ogTitle: { selector: 'meta[property="og:title"]', attr: title },
    ogDescription: { selector: 'meta[property="og:description"]', attr: site.shareDescription ?? site.description },
    siteName: { selector: "#site-name", text: site.name },
    statusTitle: { selector: "#status-title", text: profile.title },
    tabs: { selector: "#tabs", html: tabsMarkup(content) },
  } as const;
}

/** Fills the title, meta tags, title bar and tabs from the site content. Throws if any of them is missing. */
export async function applyPageMeta(html: string, content: SiteContent): Promise<string> {
  const found = new Set<string>();
  let rewriter = new HTMLRewriter();
  const specs = Object.entries(pageMeta(content));
  for (const [key, spec] of specs) {
    rewriter = rewriter.on(spec.selector, {
      element(el) {
        found.add(key);
        if ("attr" in spec) el.setAttribute("content", spec.attr);
        else if ("html" in spec) el.setInnerContent(spec.html, { html: true }); // built from escaped parts
        else el.setInnerContent(spec.text); // text is HTML-escaped by setInnerContent
      },
    });
  }
  const out = await rewriter.transform(new Response(html)).text();
  const missing = specs
    .filter(([key]) => !found.has(key))
    .map(([, spec]) => spec.selector);
  if (missing.length) throw new Error(`index.html is missing: ${missing.join(", ")}`);
  return out;
}

/** Directives a browser ignores in a <meta> policy; they only work as a response header. */
const HEADER_ONLY_DIRECTIVES = ["frame-ancestors", "report-uri", "report-to", "sandbox"];

/** The header's Content-Security-Policy without the directives that a <meta> tag can't carry. */
export function metaCsp(headerPolicy: string): string {
  return headerPolicy
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d && !HEADER_ONLY_DIRECTIVES.includes(d.split(/\s+/)[0]!.toLowerCase()))
    .join("; ");
}

/**
 * Puts the Content-Security-Policy into the page itself, as the first thing after the charset.
 * Hosts that can't send response headers (GitHub Pages) then still get the policy; on hosts that
 * do send it (Azure Static Web Apps) the page simply has the same policy twice.
 */
export async function applyCspMeta(html: string, headerPolicy: string): Promise<string> {
  const policy = metaCsp(headerPolicy);
  if (!policy) throw new Error("the Content-Security-Policy is empty");
  let done = false;
  const out = await new HTMLRewriter()
    .on('meta[http-equiv="Content-Security-Policy" i]', { element: (el) => void el.remove() })
    .on("meta[charset]", {
      element(el) {
        if (done) return;
        done = true;
        const escaped = policy.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        el.after(`\n    <meta http-equiv="Content-Security-Policy" content="${escaped}" />`, { html: true });
      },
    })
    .transform(new Response(html))
    .text();
  if (!done) throw new Error("index.html is missing: meta[charset]");
  return out;
}
