/** Turns the config's page list into page objects for the router. */
import type { NavEntry } from "../data/nav";
import { about } from "./about";
import { contact } from "./contact";
import { home } from "./home";
import { createMarkdownPage } from "./markdown";
import { createPostsPage } from "./posts";
import { createProjectsPage } from "./projects";
import type { Page } from "./types";

export function pageFor(entry: NavEntry): Page {
  const page = (() => {
    switch (entry.type) {
      case "home":
        return home;
      case "about":
        return about;
      case "contact":
        return contact;
      case "posts":
        return createPostsPage(entry.id);
      case "projects":
        return createProjectsPage(entry.id);
      case "markdown":
        return createMarkdownPage(entry.id);
    }
  })();
  return { ...page, id: entry.id, title: entry.title };
}
