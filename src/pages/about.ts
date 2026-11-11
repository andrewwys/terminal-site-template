import { avatarMarkup, mountAvatar } from "../components/avatar";
import { profile } from "../data/site";
import { html } from "../lib/html";
import type { Page } from "./types";

export const about: Page = {
  id: "about",
  title: "About",
  command: "cat about.md",
  render: () => {
    const p = profile();
    return html`
    <div class="about-grid">
      ${avatarMarkup(p.photo.src, p.photo.alt)}

      <section class="tool" aria-labelledby="bio-h">
        <h2 id="bio-h" class="tool-call"><span class="dot" aria-hidden="true">⏺</span> Read<span class="dim">(about.md)</span></h2>
        <div class="tool-result">
          <span class="elbow" aria-hidden="true">⎿</span>
          <div class="prose">
            <p class="lead"><strong>${p.name}</strong> · <span class="accent">${p.title}</span></p>
            ${p.bio.map((para) => html`<p>${para}</p>`)}
          </div>
        </div>
      </section>
    </div>

    <section class="tool" aria-labelledby="skills-h">
      <h2 id="skills-h" class="tool-call"><span class="dot" aria-hidden="true">⏺</span> Bash<span class="dim">(ls ~/skills)</span></h2>
      <div class="tool-result">
        <span class="elbow" aria-hidden="true">⎿</span>
        <div class="skills">
          ${p.skills.map(
            (s) => html`<div class="skill-group">
              <h3><span class="dir">${s.group.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/</span></h3>
              <ul>${s.items.map((i) => html`<li>${i}</li>`)}</ul>
            </div>`,
          )}
        </div>
      </div>
    </section>
  `;
  },
  mount: (root) => mountAvatar(root),
};
