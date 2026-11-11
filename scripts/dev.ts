#!/usr/bin/env bun
/**
 * Dev server with hot reload: `bun run dev` (or `bun run dev:drafts` to include drafts).
 * Serves the site from source, plus content images at the hashed URLs the build will use.
 * Restart it after editing site.config.json or anything in content/.
 */
import index from "../index.html";
import { ASSET_DIR } from "./lib/assets";
import { loadContent } from "./lib/content";

const port = Number(process.env.PORT ?? 3000);

const server = Bun.serve({
  port,
  development: true,
  routes: {
    "/": index,
    [`/${ASSET_DIR}/*`]: (req) => {
      const path = decodeURIComponent(new URL(req.url).pathname).slice(1);
      const asset = loadContent().assets.find((a) => a.url === path);
      return asset ? new Response(Bun.file(asset.file)) : new Response("Not found", { status: 404 });
    },
  },
});

console.log(`✓ Dev server at ${server.url}${process.env.SHOW_DRAFTS === "1" ? " (drafts included)" : ""}`);
