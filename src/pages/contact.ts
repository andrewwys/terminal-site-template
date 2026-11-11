import { contactEmail, firstName, formspreeConfigured, profile } from "../data/site";
import { html } from "../lib/html";
import type { Page } from "./types";

export const contact: Page = {
  id: "contact",
  title: "Contact",
  command: "open contact",
  render: () => html`
    <section class="tool" aria-labelledby="links-h">
      <h2 id="links-h" class="tool-call"><span class="dot" aria-hidden="true">⏺</span> Links</h2>
      <div class="tool-result">
        <span class="elbow" aria-hidden="true">⎿</span>
        <ul class="menu links">
          ${profile().links.map(
            (l) => html`<li><a class="menu-item" data-nav href="${l.href}"
                ${l.id === "email" ? "" : html`target="_blank" rel="noopener noreferrer"`}>
              <span class="label link-label">${l.label}</span> <span class="dim">→</span> ${l.display}
            </a></li>`,
          )}
        </ul>
      </div>
    </section>

    <section class="tool" aria-labelledby="form-h">
      <h2 id="form-h" class="tool-call"><span class="dot" aria-hidden="true">⏺</span> Send a message</h2>
      <form class="contact-form" novalidate>
        <label class="field">
          <span class="q"><span class="accent">?</span> Your name <span class="dim">›</span></span>
          <input data-nav name="name" autocomplete="name" required maxlength="100" placeholder="Ada Lovelace" />
        </label>
        <label class="field">
          <span class="q"><span class="accent">?</span> Your email <span class="dim">›</span></span>
          <input data-nav name="email" type="email" autocomplete="email" required maxlength="200" placeholder="ada@example.com" />
        </label>
        <label class="field field-msg">
          <span class="q"><span class="accent">?</span> Message <span class="dim">›</span></span>
          <textarea data-nav name="message" rows="5" required maxlength="5000" placeholder="Hi ${firstName()}, …"></textarea>
        </label>
        <input type="text" name="_gotcha" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <div class="form-actions">
          <button data-nav type="submit" class="btn">Send <span aria-hidden="true">↵</span></button>
          <span class="dim hint">Esc leaves a field · ↑↓ move between fields</span>
        </div>
        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
    </section>
  `,
  mount: (root) => {
    const form = root.querySelector<HTMLFormElement>(".contact-form")!;
    const status = form.querySelector<HTMLElement>(".form-status")!;
    const button = form.querySelector<HTMLButtonElement>("button[type=submit]")!;

    const say = (text: string, kind: "ok" | "err" | "dim") => {
      status.className = `form-status ${kind}`;
      status.textContent = text;
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = String(data.get("name") ?? "").trim();
      const email = String(data.get("email") ?? "").trim();
      const message = String(data.get("message") ?? "").trim();

      if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        say("✗ Please fill in your name, a valid email and a message.", "err");
        const firstBad = !name ? "name" : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "email" : "message";
        form.querySelector<HTMLElement>(`[name=${firstBad}]`)?.focus();
        return;
      }

      if (!formspreeConfigured()) {
        // No form backend yet: fall back to the visitor's mail client.
        const subject = encodeURIComponent(`Hello from ${name}`);
        const body = encodeURIComponent(`${message}\n\n— ${name} <${email}>`);
        location.href = `mailto:${contactEmail()}?subject=${subject}&body=${body}`;
        say("⎿ Opening your email app…", "dim");
        return;
      }

      button.disabled = true;
      say("✻ Sending…", "dim");
      try {
        const res = await fetch(`https://formspree.io/f/${profile().formspreeId}`, {
          method: "POST",
          body: data,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        form.reset();
        say("✓ Message sent. Thanks, I'll get back to you soon.", "ok");
      } catch {
        say(`✗ Couldn't send right now. Please email ${contactEmail()} instead.`, "err");
      } finally {
        button.disabled = false;
      }
    });
  },
};
