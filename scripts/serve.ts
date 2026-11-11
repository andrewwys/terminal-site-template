#!/usr/bin/env bun
/**
 * Serves the production build in ./dist for a local preview.
 * Applies the globalHeaders from staticwebapp.config.json so the preview
 * behaves like Azure Static Web Apps (e.g. the Content-Security-Policy).
 */
import { join, normalize } from "node:path";

const root = new URL("../dist/", import.meta.url).pathname;
const port = Number(process.env.PORT ?? 4173);

const configFile = Bun.file(join(root, "staticwebapp.config.json"));
const config = (await configFile.exists())
  ? ((await configFile.json()) as { globalHeaders?: Record<string, string> })
  : {};
const headers = config.globalHeaders ?? {};

const server = Bun.serve({
  port,
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
    const file = Bun.file(join(root, rel.endsWith("/") ? `${rel}index.html` : rel));
    const body = (await file.exists()) ? file : Bun.file(join(root, "index.html"));
    return new Response(body, { headers });
  },
});

console.log(`✓ Previewing dist/ at ${server.url}`);
