# Terminal career site

A personal site that looks like a terminal session: a home page with an animated pixel-art
scene, About, Projects, Posts, Contact and any extra pages you add. It's built with **Bun** and
**vanilla TypeScript**, with no framework, and deploys itself to **GitHub Pages**.

Everything on the site comes from `site.config.json` and the Markdown files in `content/`. The
code has no content of its own.

## Get your own site

1. On GitHub, press **Use this template → Create a new repository**. Make it public (GitHub
   Pages on a free account needs a public repository).
2. Open the new repository's **Actions** tab and wait for **Deploy to GitHub Pages** to finish.
3. If the run has a warning that says GitHub Pages is off: go to **Settings → Pages**, set
   **Source** to **GitHub Actions**, then run the workflow again (**Actions → Deploy to GitHub
   Pages → Run workflow**).
4. Your site is at `https://<your-username>.github.io/<repository-name>/`. The address is also
   shown on the workflow run.

From then on, every push to `main` is typechecked, tested, built and deployed. If a check fails,
the run stops and the live site keeps its last version.

## Make it yours

Edit these on GitHub, or clone the repository and run it locally (below).

| What | Where |
| --- | --- |
| Name, title, bio, skills, links, contact form | `site.config.json`, under `profile` |
| Site name and the descriptions search engines show | `site.config.json`, under `site` |
| Which pages exist and their order | `site.config.json`, under `pages` |
| Posts | `content/posts/*.md` |
| Projects | `content/projects/*.md`, with their images next to them |
| Extra pages | `content/pages/<id>.md`, plus an entry under `pages` |
| Your photo | `src/assets/`, and `profile.photo` in the config |
| The 8-bit portrait | `src/assets/portrait.ts` |

`site.config.json` is checked on every build. A missing field, a misspelt setting or a link that
isn't `https://`, `http://` or `mailto:` fails the build with a list of every problem. Editors
that understand JSON Schema (VS Code does) give autocomplete from `site.config.schema.json`.

### Your photo

Add a square image of at least 440×440 to `src/assets/` (`.svg`, `.png`, `.jpg`, `.jpeg` or
`.webp`, up to 512 KB). Set `profile.photo.src` to its path and update `profile.photo.alt`.

The About page shows an 8-bit portrait that turns into the photo on hover. The portrait is a
16×16 character map in `src/assets/portrait.ts`: redraw it to look like you.

### Contact form

Create a form at <https://formspree.io> and put its ID (the part after `/f/`) in
`profile.formspreeId`. Until then, the form opens the visitor's email app instead.

### Pages

```jsonc
"pages": [
  { "id": "home", "type": "home" },
  { "id": "about", "type": "about" },
  { "id": "projects", "type": "projects" },
  { "id": "posts", "type": "posts", "title": "Blog" },
  { "id": "uses", "type": "markdown" },
  { "id": "contact", "type": "contact" },
  { "id": "now", "type": "markdown", "hidden": true }
]
```

- `id` is the page's address (`#/uses`) and its prompt command (`/uses`).
- `type` is a built-in page (`home`, `about`, `projects`, `posts`, `contact`; one of each at
  most, and `home` is required) or `markdown` for a page of your own, read from
  `content/pages/<id>.md`.
- `title` (optional) is the tab label. `description` (optional) is the text in `help` and the
  Home menu.
- `hidden: true` keeps a page out of the tabs and menus. It's still reachable at its address.

### Posts

```markdown
---
title: "Hello, world"       # required
date: 2026-01-01            # required, YYYY-MM-DD
project: "My project"       # optional; filters appear once there are two or more
tags: [meta]                # optional
linkedin: https://www.linkedin.com/feed/update/…/   # optional "View on LinkedIn" link
draft: true                 # optional; left out of the site
---

The post, in Markdown. Raw HTML is shown as text, not rendered.
```

The file name (without `.md`) is the post's address: `#/posts/hello-world`.

### Projects

```markdown
---
title: My project                          # required
summary: One or two sentences.             # required, up to 300 characters
tags: [bun, typescript]                    # optional; filters appear once there are two or more
repo: https://github.com/you/project       # optional "Source" link
demo: https://example.com                  # optional "Live demo" link
date: 2026-01-01                           # optional, YYYY-MM-DD
featured: true                             # optional; featured projects come first
order: 1                                   # optional; lower comes first, after featured
image: screenshot.png                      # optional; a file next to this one, up to 1 MB
imageAlt: The project's main screen        # required with image
draft: true                                # optional; left out of the site
---

An optional longer write-up, in Markdown.
```

### Custom pages

```markdown
---
title: Uses                     # required
description: the tools I use    # optional
command: cat ~/uses.md          # optional: the line "typed" at the top of the page
---

The page, in Markdown.
```

## Run it locally

Install [Bun](https://bun.sh), then:

```bash
bun install
```

```bash
bun run dev
```

| Command | What it does |
| --- | --- |
| `bun run dev` | dev server with hot reload at `http://localhost:3000` |
| `bun run dev:drafts` | the same, with draft posts and projects included |
| `bun run build` | static build into `dist/` |
| `bun run preview` | build, then serve `dist/` at `http://localhost:4173` |
| `bun test` | unit tests |
| `bun run typecheck` | TypeScript check |

Restart the dev server after editing `site.config.json` or anything in `content/`.

## Workflows

| File | When | What |
| --- | --- | --- |
| `.github/workflows/deploy-pages.yml` | every push to `main` | typecheck, test, build, deploy to GitHub Pages. Needs no secrets. |
| `.github/workflows/ci.yml` | pull requests and other branches | typecheck, test, build |
| `.github/workflows/update-from-template.yml` | Mondays, or by hand | opens a pull request when the template has a newer version |

GitHub Pages can't send security headers, so the build writes the site's Content-Security-Policy
into `dist/index.html` as a `<meta>` tag. The policy itself is in `staticwebapp.config.json`. If
you load something from a new third-party address, add it there.

## Getting updates

`template.json` records which version of the template this site is on and which files the
template owns. **Update from template** checks for a newer version every Monday (or run it from
the Actions tab). When there is one, it:

1. copies the template's files over yours;
2. leaves your content alone: `site.config.json`, `content/`, `src/assets/`, `README.md` and any
   file you added;
3. upgrades `site.config.json` if its format changed;
4. runs the typecheck, tests and build with your content;
5. opens a pull request for you to review and merge.

Two things GitHub doesn't allow by default:

- **Opening the pull request.** If the run says it isn't allowed to, tick **Allow GitHub Actions
  to create and approve pull requests** under **Settings → Actions → General → Workflow
  permissions**. Or open the pull request yourself from the link in the run's summary: the
  branch is already pushed.
- **Changing workflow files.** A workflow's own token can't edit `.github/workflows/`. The pull
  request lists any workflow files that changed, to copy by hand. To have them updated too,
  create a fine-grained personal access token for this repository with **Contents**, **Pull
  requests** and **Workflows** set to read and write, and save it as a repository secret named
  `TEMPLATE_UPDATE_TOKEN`.

If you changed a file the template owns (anything outside the list in step 2), the update
replaces it. The pull request shows the difference, so you can put your change back before
merging.

## Other hosts

`bun run build` writes a fully static site to `dist/`, with relative paths and hash routes
(`#/about`), so it works on any static host and under any path.
`staticwebapp.config.json` is there for Azure Static Web Apps, where it sets the security and
caching headers.

## License

The code is under the [MIT License](LICENSE). Your content (`site.config.json`, `content/`, your
photo and portrait) is yours.

Made from the [terminal career site](https://github.com/andrewwys/bun-andrewwy) by Andrew WY.
