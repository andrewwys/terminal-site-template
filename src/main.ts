/**
 * Entry point for this site. The macro runs when the site is bundled: it reads and checks
 * site.config.json and content/ (posts, projects, pages), and inlines them as plain data, so the
 * deployed site stays fully static. Everything else lives in app.ts and works with any content.
 */
import { siteContent } from "../scripts/site-macro" with { type: "macro" };
import { boot } from "./app";

boot(siteContent());
