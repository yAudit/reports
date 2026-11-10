// Browser-side enhancements of a report page: highlighted code blocks with
// line numbers and a copy button, and the contents entry for the section on
// screen.
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import diff from "highlight.js/lib/languages/diff";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import shell from "highlight.js/lib/languages/shell";
import typescript from "highlight.js/lib/languages/typescript";
import yaml from "highlight.js/lib/languages/yaml";
import hljsSolidity from "highlightjs-solidity";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("shell", shell);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("yaml", yaml);
hljsSolidity(hljs);

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  patch: "diff",
  py: "python",
  rs: "rust",
  sh: "bash",
  sol: "solidity",
  ts: "typescript",
  yml: "yaml",
};

const LANGUAGE_LABELS: Record<string, string> = {
  bash: "Shell",
  diff: "Diff",
  javascript: "JavaScript",
  json: "JSON",
  python: "Python",
  rust: "Rust",
  shell: "Shell",
  solidity: "Solidity",
  typescript: "TypeScript",
  yaml: "YAML",
  yul: "Yul",
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function normalizeLanguage(language: string): string | null {
  const normalized = language.toLowerCase().replace(/^language-/, "").replace(/^lang-/, "");
  return LANGUAGE_ALIASES[normalized] || normalized || null;
}

function detectLanguage(code: HTMLElement): string | null {
  const explicit = [...code.classList]
    .map(normalizeLanguage)
    .find((language) => language && hljs.getLanguage(language));
  if (explicit) return explicit;

  const text = code.textContent || "";
  if (/\bpragma\s+solidity\b/.test(text) || /\bcontract\s+\w+/.test(text)) return "solidity";
  return null;
}

function highlight(rawCode: string, language: string | null): string {
  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(rawCode, { language, ignoreIllegals: true }).value;
    }
    return hljs.highlightAuto(rawCode).value;
  } catch {
    return escapeHtml(rawCode);
  }
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function enhanceCodeBlock(code: HTMLElement) {
  const pre = code.closest("pre");
  if (!pre || pre.closest(".code-snippet-frame")) return;

  const language = detectLanguage(code);
  const rawCode = (code.textContent || "").replace(/\n$/, "");
  const lines = highlight(rawCode, language).replace(/\n$/, "").split("\n");

  // highlight.js can open a span on one line and close it on a later one, so
  // each line closes the spans still open at its end and reopens them on the
  // next line.
  const open: string[] = [];
  code.innerHTML = lines
    .map((line, index) => {
      const prefix = open.join("");
      const tags = line.match(/<span[^>]*>|<\/span>/g) || [];
      for (const tag of tags) {
        if (tag === "</span>") open.pop();
        else open.push(tag);
      }
      const suffix = "</span>".repeat(open.length);
      const content = `${prefix}${line}${suffix}`;
      return [
        '<span class="code-line">',
        `<span class="line-number" aria-hidden="true">${index + 1}</span>`,
        `<span class="line-content">${content || "&nbsp;"}</span>`,
        "</span>",
      ].join("");
    })
    .join("");

  code.classList.add("hljs");
  if (language) code.classList.add(`language-${language}`);

  const frame = document.createElement("div");
  frame.className = "code-snippet-frame";

  const header = document.createElement("div");
  header.className = "code-snippet-header";

  const label = document.createElement("span");
  label.className = "code-snippet-language";
  label.textContent = (language && LANGUAGE_LABELS[language]) || "Code";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "code-snippet-copy";
  button.textContent = "Copy";
  button.addEventListener("click", async () => {
    try {
      await copyToClipboard(rawCode);
      button.textContent = "Copied";
      button.classList.add("copied");
      setTimeout(() => {
        button.textContent = "Copy";
        button.classList.remove("copied");
      }, 1400);
    } catch {
      button.textContent = "Failed";
    }
  });

  header.append(label, button);
  pre.before(frame);
  frame.append(header, pre);
}

export function enhanceReportMarkdown(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(".report-markdown pre code").forEach(enhanceCodeBlock);
}

/**
 * Marks the contents links ([data-report-nav-link]) of the section on screen
 * with aria-current. Returns a function that stops it.
 */
export function syncReportNavigation(): () => void {
  const navLinks = [...document.querySelectorAll<HTMLElement>("[data-report-nav-link]")];
  const sections = [...new Set(navLinks.map((link) => link.dataset.sectionId))]
    .map((id) => (id ? document.getElementById(id) : null))
    .filter((section): section is HTMLElement => section !== null);
  if (sections.length === 0) return () => {};

  const activate = (sectionId: string) => {
    navLinks.forEach((link) => {
      if (link.dataset.sectionId === sectionId) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  };

  const visible = new Map<string, IntersectionObserverEntry>();
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => visible.set(entry.target.id, entry));
      const active = [...visible.entries()]
        .filter(([, entry]) => entry.isIntersecting)
        .sort((a, b) => b[1].intersectionRatio - a[1].intersectionRatio)[0];
      if (active) activate(active[0]);
    },
    { rootMargin: "-20% 0px -60% 0px", threshold: [0.1, 0.3, 0.6] }
  );

  sections.forEach((section) => observer.observe(section));
  activate(window.location.hash.replace("#", "") || sections[0].id);
  return () => observer.disconnect();
}
