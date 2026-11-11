/** Loads everything the site renders: the config and its Markdown content. Used by the bundle macro and the build. */
import type { SiteContent } from "../../src/data/types";
import type { Asset } from "./assets";
import { loadConfig } from "./config";
import { loadCustomPages } from "./custom-pages";
import { loadPosts } from "./posts";
import { loadProjects } from "./projects";

export function loadContent(): { content: SiteContent; assets: Asset[] } {
  const config = loadConfig();
  const { projects, assets } = loadProjects();
  return { content: { config, posts: loadPosts(), projects, customPages: loadCustomPages(config) }, assets };
}
