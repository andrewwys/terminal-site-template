import { esc, html, raw, type Raw } from "../lib/html";

export interface Command {
  name: string;
  aliases?: string[];
  desc: string;
  /** Hidden from help and suggestions (easter eggs). */
  hidden?: boolean;
  run(args: string[]): Raw | string | void;
}

const MAX_ENTRIES = 4;

/**
 * Claude Code-style input box at the bottom of the screen.
 * Supports `/` suggestions (Tab to complete), ↑/↓ history and Esc to leave.
 */
export class Prompt {
  readonly input: HTMLInputElement;
  private readonly out: HTMLElement;
  private readonly suggest: HTMLElement;
  private history: string[] = [];
  private hIndex = -1;

  constructor(
    form: HTMLFormElement,
    out: HTMLElement,
    suggest: HTMLElement,
    private readonly commands: Command[],
  ) {
    this.input = form.querySelector("input")!;
    this.out = out;
    this.suggest = suggest;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = this.input.value.trim();
      this.input.value = "";
      this.renderSuggestions();
      if (value) this.run(value);
    });

    this.input.addEventListener("input", () => {
      this.hIndex = -1;
      this.renderSuggestions();
    });
    this.input.addEventListener("blur", () => this.renderSuggestions(true));
    this.input.addEventListener("focus", () => this.renderSuggestions());

    this.input.addEventListener("keydown", (e) => {
      switch (e.key) {
        case "Escape":
          this.input.value = "";
          this.renderSuggestions(true);
          this.input.blur();
          break;
        case "Tab": {
          const [first] = this.matches();
          if (!first || !this.input.value.startsWith("/")) return;
          this.input.value = `/${first.name}`;
          this.renderSuggestions();
          break;
        }
        case "ArrowUp":
          if (!this.history.length) return;
          this.hIndex = Math.min(this.hIndex + 1, this.history.length - 1);
          this.input.value = this.history[this.hIndex] ?? "";
          break;
        case "ArrowDown":
          this.hIndex = Math.max(this.hIndex - 1, -1);
          this.input.value = this.hIndex < 0 ? "" : (this.history[this.hIndex] ?? "");
          break;
        default:
          return;
      }
      e.preventDefault();
    });
  }

  focus(prefill = ""): void {
    this.input.value = prefill;
    this.input.focus();
    this.renderSuggestions();
  }

  private find(name: string): Command | undefined {
    const n = name.replace(/^\//, "").toLowerCase();
    return this.commands.find((c) => c.name === n || c.aliases?.includes(n));
  }

  private matches(): Command[] {
    const v = this.input.value;
    if (!v.startsWith("/")) return [];
    const q = v.slice(1).toLowerCase();
    return this.commands.filter((c) => !c.hidden && c.name.startsWith(q));
  }

  private renderSuggestions(hide = false): void {
    const list = hide ? [] : this.matches();
    this.suggest.hidden = list.length === 0;
    this.suggest.innerHTML = list
      .map((c) => `<li><span class="s-name">/${esc(c.name)}</span><span class="s-desc">${esc(c.desc)}</span></li>`)
      .join("");
  }

  run(line: string): void {
    this.history.unshift(line);
    this.history = this.history.slice(0, 50);
    this.hIndex = -1;

    const [name = "", ...args] = line.trim().split(/\s+/);
    const cmd = this.find(name);
    if (cmd?.name === "clear") {
      this.clear();
      return;
    }
    let result: Raw | string | void;
    try {
      result = cmd
        ? cmd.run(args)
        : html`<span class="err">command not found: ${name}</span> · type <kbd>help</kbd> for a list of commands`;
    } catch (err) {
      result = html`<span class="err">error: ${String(err)}</span>`;
    }
    this.print(line, result);
  }

  print(echo: string, result: Raw | string | void): void {
    const entry = document.createElement("div");
    entry.className = "entry";
    const body = typeof result === "string" ? esc(result) : (result?.value ?? "");
    entry.innerHTML = html`<p class="echo"><span class="ps1">›</span> ${echo}</p>${
      body ? raw(`<div class="result"><span class="elbow" aria-hidden="true">⎿</span><div>${body}</div></div>`) : ""
    }`.value;
    this.out.append(entry);
    while (this.out.children.length > MAX_ENTRIES) this.out.firstElementChild?.remove();
    this.out.hidden = false;
    this.out.scrollTop = this.out.scrollHeight;
  }

  clear(): void {
    this.out.innerHTML = "";
    this.out.hidden = true;
  }
}
