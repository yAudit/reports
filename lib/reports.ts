// Reads the reports for the list and the report pages. Server only: it is
// used from getStaticProps and getStaticPaths.
//
// A report is a markdown file in content/, with its PDF in public/pdf. Its
// data comes from one of:
//
// - content/data/<name>.json, imported from the report repository on GitHub
//   (config.yaml and the findings in its issues) by scripts/import-github.mjs.
// - the markdown itself, for the older reports written in markdown. Its
//   sections are mapped onto the same ones.
// - nothing else: the report is only a PDF, and the page shows the PDF.
//
// content/data/protocols.json names the protocol of a report (see
// protocolOverrides).
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import {
  extractDate,
  findEmbeddedPdf,
  findMatchingPdf,
  getAllReportSlugs,
  getCanonicalSlug,
  isoDateFromSlug,
  renderMarkdown,
} from "./utils";
import {
  Commit,
  Evaluation,
  ExtraSection,
  Finding,
  FindingSection,
  ReportDetail,
  ReportSummary,
  Severity,
  SeverityCounts,
  SourceLink,
} from "./reportTypes";

const CONTENT_DIR = path.join(process.cwd(), "content");
const PDF_DIR = path.join(process.cwd(), "public", "pdf");
const DATA_DIR = path.join(process.cwd(), "content", "data");
const PROTOCOLS_FILE = path.join(DATA_DIR, "protocols.json");

const SEVERITY_RANK: Record<Severity, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
  Informational: 4,
  Gas: 5,
  Undetermined: 99,
};

const SEVERITY_PREFIX: Record<Severity, string> = {
  Critical: "C",
  High: "H",
  Medium: "M",
  Low: "L",
  Undetermined: "U",
  Informational: "I",
  Gas: "G",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The labels of the sections of a finding, in the order they are shown.
const FINDING_SECTION_ORDER: [string, string][] = [
  ["intro", "Summary"],
  ["technical_details", "Description"],
  ["technical_description", "Description"],
  ["impact", "Impact"],
  ["example", "Example"],
  ["recommendation", "Recommendation"],
  ["developer_response", "Developer Response"],
];
const FINDING_SECTION_LABELS: Record<string, string> = Object.fromEntries(FINDING_SECTION_ORDER);

// ---------------------------------------------------------------------------
// Small helpers

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const blank = (value: string | null | undefined): value is null | undefined | "" =>
  !value || value.trim() === "";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function plainText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__/g, "")
    .trim();
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

const isoDate = ({ year, month, day }: DateParts) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const toTime = ({ year, month, day }: DateParts) => Date.UTC(year, month - 1, day);

function parseIsoDate(value: string | null | undefined): DateParts | null {
  const match = (value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return { year: +match[1], month: +match[2], day: +match[3] };
  const time = Date.parse(value || "");
  if (Number.isNaN(time)) return null;
  const date = new Date(time);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** "Oct 07, 2026" */
const compactDate = (date: DateParts | null) =>
  date
    ? `${MONTHS[date.month - 1]} ${String(date.day).padStart(2, "0")}, ${date.year}`
    : "Not specified";

/** "Oct 2026", from the YYYY-MM of a slug. */
function slugMonth(slug: string): string {
  const match = slug.match(/^(\d{4})-(\d{2})/);
  return match ? `${MONTHS[+match[2] - 1]} ${match[1]}` : "";
}

function auditDays(start: DateParts | null, finish: DateParts | null): number | null {
  if (!start || !finish) return null;
  const days = Math.round((toTime(finish) - toTime(start)) / 86_400_000) + 1;
  return days > 0 ? days : null;
}

function nslocFrom(text: string): number | null {
  const match = text.match(/(\d[\d,]*)\s+(?:n?SLOC|lines of code)/i);
  if (!match) return null;
  const count = parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(count) ? count : null;
}

const sourceLabel = (url: string) =>
  url.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");

function countSeverities(findings: { severity: Severity | null }[]): SeverityCounts {
  const counts: SeverityCounts = {};
  for (const { severity } of findings) {
    if (severity) counts[severity] = (counts[severity] ?? 0) + 1;
  }
  return counts;
}

// Sorted by severity, refs numbered per severity: H-1, H-2, M-1...
function withRefs<T extends { severity: Severity | null }>(
  findings: T[],
  order: (finding: T) => number
): (T & { ref: string })[] {
  const counts: Record<string, number> = {};
  return [...findings]
    .sort(
      (a, b) =>
        (a.severity ? SEVERITY_RANK[a.severity] : 99) -
          (b.severity ? SEVERITY_RANK[b.severity] : 99) || order(a) - order(b)
    )
    .map((finding) => {
      const prefix = finding.severity ? SEVERITY_PREFIX[finding.severity] : "U";
      counts[prefix] = (counts[prefix] ?? 0) + 1;
      return { ...finding, ref: `${prefix}-${counts[prefix]}` };
    });
}

// "Technical Details" -> "technical_details"
const sectionKey = (title: string) =>
  title
    .toLowerCase()
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const humanize = (key: string) =>
  key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

// ---------------------------------------------------------------------------
// Markdown reports

// "1. High - Title", "2. Gas: Title", "3. Informational Title"
const FINDING_HEADING =
  /^(\d+)\.\s+(Critical|High|Medium|Low|Undetermined|Informational|Info|Gas)\b\s*(?:[-–—:]\s*)?(.*)$/i;

// "Findings", "High Findings", "Gas Savings Findings"...
const FINDINGS_SECTION =
  /^(?:(?:critical|high|medium|low|undetermined|informational|info|gas)(?:\s+savings?)?\s+)?findings$/i;

// Section names that tell which heading level the report uses for sections.
const KNOWN_SECTION =
  /^(table of contents|review summary|protocol summary|scope|code evaluation matrix|findings explanation|findings|final remarks)\b/i;

interface Heading {
  line: number;
  depth: number;
  text: string;
}

interface RawSection {
  title: string;
  markdown: string;
}

interface RawFinding {
  index: number;
  severity: Severity;
  title: string;
  heading: string;
  markdown: string;
}

export interface ParsedReport {
  /** The H1 as written: "yAudit RAMSES Review" */
  title: string | null;
  auditors: string[];
  sections: RawSection[];
  findings: RawFinding[];
}

const cleanHeading = (text: string) =>
  text.replace(/<!--.*?-->/g, "").replace(/\*\*|__/g, "").trim();

// Markdown headings, outside fenced code blocks.
function findHeadings(lines: string[]): Heading[] {
  const headings: Heading[] = [];
  let fence: string | null = null;
  lines.forEach((line, index) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1];
      else if (fenceMatch[1].startsWith(fence)) fence = null;
      return;
    }
    if (fence) return;
    const match = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (match) {
      headings.push({ line: index, depth: match[1].length, text: cleanHeading(match[2]) });
    }
  });
  return headings;
}

function normalizeSeverity(value: string): Severity {
  const lower = value.toLowerCase();
  if (lower === "info") return "Informational";
  return (lower.charAt(0).toUpperCase() + lower.slice(1)) as Severity;
}

// The id remarkHeadingIds gave the heading on the old report page.
function legacyHeadingId(heading: string): string {
  return heading
    .replace(/`/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

// The auditors listed before the first section.
function parseAuditors(lines: string[]): string[] {
  const auditors: string[] = [];
  let inAuditors = false;
  for (const line of lines) {
    if (/^\s*(\*\*)?\s*auditors\s*:?\s*(\*\*)?\s*:?\s*$/i.test(line)) {
      inAuditors = true;
      continue;
    }
    if (!inAuditors) continue;
    const item = line.match(/^\s*[-*]\s+(.+)$/);
    if (item) auditors.push(plainText(item[1]));
    else if (line.trim() !== "") inAuditors = false;
  }
  return auditors;
}

export function parseReport(markdown: string): ParsedReport {
  const lines = markdown.split(/\r?\n/);
  const headings = findHeadings(lines);

  // A report opens with "# yAudit <Name> Review".
  const titleHeading = headings[0]?.depth === 1 ? headings[0] : null;
  const rest = titleHeading ? headings.slice(1) : headings;

  const known = rest.find((heading) => KNOWN_SECTION.test(heading.text));
  const sectionDepth = known
    ? known.depth
    : rest.length
      ? Math.min(...rest.map((heading) => heading.depth))
      : 2;
  const sectionHeadings = rest.filter((heading) => heading.depth === sectionDepth);

  const start = titleHeading ? titleHeading.line + 1 : 0;
  const auditors = parseAuditors(lines.slice(start, sectionHeadings[0]?.line ?? lines.length));

  const sections: RawSection[] = [];
  const findings: RawFinding[] = [];

  sectionHeadings.forEach((heading, index) => {
    const end = sectionHeadings[index + 1]?.line ?? lines.length;
    if (/^table of contents/i.test(heading.text)) return;

    const inside = rest.filter(
      (h) => h.line > heading.line && h.line < end && h.depth > sectionDepth
    );
    const findingHeadings = inside.filter((h) => FINDING_HEADING.test(h.text));

    if (findingHeadings.length === 0 && !FINDINGS_SECTION.test(heading.text)) {
      sections.push({
        title: heading.text,
        markdown: lines.slice(heading.line + 1, end).join("\n").trim(),
      });
      return;
    }

    for (const findingHeading of findingHeadings) {
      const next = rest.find(
        (h) => h.line > findingHeading.line && h.depth <= findingHeading.depth
      );
      const findingEnd = Math.min(next?.line ?? lines.length, end);
      const [, , severity, title] = findingHeading.text.match(FINDING_HEADING)!;
      findings.push({
        index: findings.length,
        severity: normalizeSeverity(severity),
        title: title.trim() || findingHeading.text,
        heading: findingHeading.text,
        markdown: lines.slice(findingHeading.line + 1, findingEnd).join("\n").trim(),
      });
    }
  });

  return { title: titleHeading?.text || null, auditors, sections, findings };
}

/** "yAudit RAMSES Review" -> "RAMSES", "yAudit Euler … Locked - Review" -> "Euler … Locked" */
function protocolFromTitle(title: string): string {
  return (
    title
      .replace(/^(?:yAudit|yAcademy)\s+/i, "")
      .replace(/\s+(?:Security\s+)?(?:Review|Audit|Report)(?:\s+Report)?\s*$/i, "")
      .replace(/\s*[-–—:]\s*$/, "")
      .trim() || title
  );
}

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

interface PartialDate {
  year?: number;
  month?: number;
  day?: number;
}

function partialDate(text: string): PartialDate {
  const numeric = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (numeric) {
    // The reports write day/month/year.
    let [day, month] = [+numeric[1], +numeric[2]];
    if (month > 12) [day, month] = [month, day];
    return { day, month, year: +numeric[3] };
  }
  const monthName = text
    .toLowerCase()
    .match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?/);
  const day = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  const year = text.match(/\b(20\d{2})\b/);
  return {
    month: monthName ? MONTH_NAMES.indexOf(monthName[1]) + 1 : undefined,
    day: day ? +day[1] : undefined,
    year: year ? +year[1] : undefined,
  };
}

/**
 * The review dates in the review summary: "between June 26 and July 30,
 * 2023", "between 16 January 2024 and 19 January 2024", "between 06/06/2023
 * and 18/06/2023", "between the 31st of March and the 3rd of April, 2025"...
 */
export function parseTimeline(text: string): { start: DateParts; finish: DateParts } | null {
  const pattern =
    /\b(?:between|from)\s+(?:the\s+)?(.{1,40}?)\s+(?:and|to|until|through|-|–)\s+(?:the\s+)?(.{1,30}?\b20\d{2})\b/gi;
  for (const match of plainText(text).matchAll(pattern)) {
    const left = partialDate(match[1]);
    const right = partialDate(match[2]);
    if (!right.year || !left.day || !right.day) continue;
    const finishMonth = right.month ?? left.month;
    const startMonth = left.month ?? right.month;
    if (!finishMonth || !startMonth) continue;
    const finish = { year: right.year, month: finishMonth, day: right.day };
    let start = { year: left.year ?? right.year, month: startMonth, day: left.day };
    if (!left.year && toTime(start) > toTime(finish)) start = { ...start, year: start.year - 1 };
    const days = (toTime(finish) - toTime(start)) / 86_400_000;
    if (days < 0 || days > 120) continue;
    return { start, finish };
  }
  return null;
}

/**
 * Splits the review summary into the protocol overview and the paragraphs
 * about the review itself ("The contracts of ... were reviewed over...").
 */
function splitSummary(markdown: string): { overview: string; review: string } {
  const blocks = markdown.split(/\n\s*\n/).filter((block) => block.trim() !== "");
  // The first block is often only the protocol name, in bold.
  if (blocks.length > 1 && /^\s*\*\*[^*]+\*\*\s*$/.test(blocks[0])) blocks.shift();
  const index = blocks.findIndex((block) =>
    /\b(?:were|was)\s+reviewed\b|\breviewed over\b|\bcode review was\b|\bperformed the code review\b/i.test(
      block
    )
  );
  if (index <= 0) return { overview: blocks.join("\n\n"), review: "" };
  return { overview: blocks.slice(0, index).join("\n\n"), review: blocks.slice(index).join("\n\n") };
}

// The repositories and the reviewed commits linked from the summary and the
// scope.
function sourceLinks(markdown: string): { repositories: SourceLink[]; commits: Commit[] } {
  const repositories = new Map<string, SourceLink>();
  const commits = new Map<string, Commit>();
  const pattern =
    /https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/(tree|commit|blob)\/([0-9a-f]{7,40})\b[^\s)\]"'>]*)?/gi;
  for (const match of markdown.matchAll(pattern)) {
    const owner = match[1];
    const repo = match[2].replace(/\.+$/, "").replace(/\.git$/, "");
    if (owner === "orgs" || !repo) continue;
    const url = `https://github.com/${owner}/${repo}`;
    if (!repositories.has(url.toLowerCase())) {
      repositories.set(url.toLowerCase(), { url, label: sourceLabel(url) });
    }
    const hash = match[4];
    if (hash && !commits.has(hash.slice(0, 7))) {
      commits.set(hash.slice(0, 7), { hash, url: match[0] });
    }
  }
  return { repositories: [...repositories.values()], commits: [...commits.values()] };
}

interface MatrixRow {
  category: string;
  score: string | null;
  description: string;
}

// The first table of the Code Evaluation Matrix: category, mark, description.
function parseMatrix(markdown: string): MatrixRow[] {
  const lines = markdown.split(/\r?\n/);
  const first = lines.findIndex((line) => /^\s*\|/.test(line));
  if (first < 0) return [];
  const table: string[] = [];
  for (const line of lines.slice(first)) {
    if (!/^\s*\|/.test(line)) break;
    table.push(line);
  }
  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim());
  return table
    .filter((line) => !/^\s*\|?\s*:?-{2,}/.test(line))
    .slice(1)
    .map(cells)
    .filter((row) => row[0])
    .map((row) => ({
      category: plainText(row[0]),
      score: plainText(row[1] || "") || null,
      description: row.slice(2).join(" | "),
    }));
}

// The sections of a finding of a markdown report, at the first heading level
// below the finding.
function markdownFindingSections(markdown: string): { label: string; markdown: string }[] {
  const lines = markdown.split(/\r?\n/);
  const headings = findHeadings(lines);
  if (headings.length === 0) return [{ label: "Details", markdown }];
  const depth = Math.min(...headings.map((heading) => heading.depth));
  const top = headings.filter((heading) => heading.depth === depth);
  const sections: { label: string; markdown: string }[] = [];
  const intro = lines.slice(0, top[0].line).join("\n").trim();
  if (intro) sections.push({ label: "Summary", markdown: intro });
  top.forEach((heading, index) => {
    const body = lines
      .slice(heading.line + 1, top[index + 1]?.line ?? lines.length)
      .join("\n")
      .trim();
    const title = heading.text.replace(/\s*:\s*$/, "");
    if (body) {
      sections.push({ label: FINDING_SECTION_LABELS[sectionKey(title)] ?? title, markdown: body });
    }
  });
  return sections.length ? sections : [{ label: "Details", markdown }];
}

const SECTION_KIND: [RegExp, string][] = [
  [/^(?:review|protocol) summary\b/i, "summary"],
  [/^scope\b/i, "scope"],
  [/^code evaluation matrix\b/i, "matrix"],
  [/^final remarks?\b/i, "remarks"],
  // The severity classification table replaces it.
  [/^findings explanation\b/i, "skip"],
  [/^about yaudit\b/i, "skip"],
];

interface MarkdownReport {
  title: string;
  protocol: string;
  auditors: string[];
  start: DateParts | null;
  finish: DateParts | null;
  nsloc: number | null;
  overview: string;
  scope: string;
  repositories: SourceLink[];
  commits: Commit[];
  matrix: MatrixRow[];
  extras: RawSection[];
  finalRemarks: string | null;
  findings: (RawFinding & { ref: string })[];
}

function readMarkdownReport(parsed: ParsedReport, fallback: string): MarkdownReport {
  let summary = "";
  let scope = "";
  let matrix = "";
  let finalRemarks: string | null = null;
  const seen = new Set<string>();
  const extras: RawSection[] = [];

  for (const section of parsed.sections) {
    const kind = SECTION_KIND.find(([pattern]) => pattern.test(section.title))?.[1];
    if (kind === "skip") continue;
    if (!kind || seen.has(kind)) {
      extras.push(section);
      continue;
    }
    seen.add(kind);
    if (kind === "summary") summary = section.markdown;
    else if (kind === "scope") scope = section.markdown;
    else if (kind === "matrix") matrix = section.markdown;
    else finalRemarks = section.markdown;
  }

  const { overview, review } = splitSummary(summary);
  const rows = parseMatrix(matrix);
  if (rows.length === 0 && !blank(matrix)) {
    extras.unshift({ title: "Code Evaluation Matrix", markdown: matrix });
  }
  const timeline = parseTimeline(summary);
  const title = parsed.title || fallback;

  return {
    title,
    protocol: protocolFromTitle(title),
    auditors: parsed.auditors,
    start: timeline?.start ?? null,
    finish: timeline?.finish ?? null,
    nsloc: nslocFrom(`${summary}\n${scope}`),
    overview,
    scope: [review, scope].filter((part) => !blank(part)).join("\n\n"),
    ...sourceLinks(`${summary}\n${scope}`),
    matrix: rows,
    extras,
    finalRemarks,
    findings: withRefs(parsed.findings, (finding) => finding.index),
  };
}

// ---------------------------------------------------------------------------
// Reports imported from GitHub (scripts/import-github.mjs)

interface ImportedReport {
  repo: string;
  githubUrl?: string;
  title: string | null;
  protocolName: string | null;
  protocolOverview: string | null;
  auditScope: string | null;
  overallAssessment: string | null;
  startDate: string | null;
  finishDate: string | null;
  auditors: string[];
  commits: { label: string | null; hash: string; url: string | null }[];
  repositories: string[];
  finalRemarks: string | null;
  nsloc: number | null;
  evaluations: { category: string; score: string | null; description: string | null }[];
  issues: { number: number; title: string | null; severity: Severity | null; body: string }[];
}

/**
 * The sections of an issue body: every heading
 * starts one, the text before the first is the summary, and the known ones
 * come first, in a fixed order.
 */
function issueSections(body: string): { label: string; markdown: string }[] {
  const sections = new Map<string, string>();
  let key = "intro";
  let lines: string[] = [];
  let inCode = false;
  const flush = () => {
    const text = lines.join("\n").trim();
    if (text) sections.set(key, text);
  };
  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    const heading = inCode ? null : line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flush();
      key = sectionKey(heading[1]);
      lines = [];
    } else {
      lines.push(line);
    }
    if (line.trimStart().startsWith("```")) inCode = !inCode;
  }
  flush();

  const known = FINDING_SECTION_ORDER.map(([name]) => name);
  const pairs = [
    ...FINDING_SECTION_ORDER.filter(([name]) => sections.has(name)).map(([name, label]) => ({
      label,
      markdown: sections.get(name)!,
    })),
    ...[...sections.keys()]
      .filter((name) => !known.includes(name))
      .sort()
      .map((name) => ({ label: humanize(name), markdown: sections.get(name)! })),
  ];
  return pairs.length ? pairs : [{ label: "Details", markdown: body }];
}

function readImported(name: string): ImportedReport | null {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as ImportedReport;
}

// ---------------------------------------------------------------------------
// Loading

function isPdfOnly(body: string): boolean {
  const trimmed = body.trim();
  return trimmed === "" || /^<(object\s+data|embed\s+src)="pdf\//i.test(trimmed);
}

function fallbackTitle(frontmatterTitle: unknown, filename: string): string {
  return (
    (typeof frontmatterTitle === "string" &&
      frontmatterTitle.split("-").slice(2).join(" ").trim()) ||
    filename.replace(/\.md$/, "")
  );
}

type Source =
  | { kind: "imported"; report: ImportedReport }
  | { kind: "markdown"; report: MarkdownReport }
  | { kind: "pdf" };

interface LoadedReport {
  slug: string;
  /** The title from the frontmatter, for reports without data */
  fallbackTitle: string;
  description: string;
  tags: string[];
  pdf: string | null;
  /** The protocol set in content/data/protocols.json, if any */
  protocol: string | null;
  source: Source;
}

/**
 * content/data/protocols.json: { "Protocol": ["<content file without .md>", ...] }.
 *
 * The protocol of a report listed there wins over the one the report brings:
 * the name taken from the title of an older report written in markdown
 * ("yAudit Euler EVC Review" -> "Euler EVC"), and protocolName of an imported
 * one, which comes from the config.yaml of its repository and comes back on
 * every import. So one protocol shows under one name on the cards, in the
 * client filter and on the report page, without changing the markdown files
 * or the report repositories.
 *
 * A name that matches no report, or a report listed twice, stops the build,
 * so a typo cannot go unnoticed.
 */
function protocolOverrides(): Map<string, string> {
  const overrides = new Map<string, string>();
  if (!fs.existsSync(PROTOCOLS_FILE)) return overrides;

  const groups = JSON.parse(fs.readFileSync(PROTOCOLS_FILE, "utf8")) as Record<string, string[]>;
  for (const [protocol, names] of Object.entries(groups)) {
    for (const name of names) {
      if (!fs.existsSync(path.join(CONTENT_DIR, `${name}.md`))) {
        throw new Error(
          `content/data/protocols.json: "${protocol}" lists ${name}, but content/${name}.md does not exist`
        );
      }
      const other = overrides.get(name);
      if (other) {
        throw new Error(
          `content/data/protocols.json: ${name} is listed under both "${other}" and "${protocol}"`
        );
      }
      overrides.set(name, protocol);
    }
  }
  return overrides;
}

function loadReport(
  filename: string,
  pdfFiles: string[],
  protocols: Map<string, string>
): LoadedReport {
  const file = fs.readFileSync(path.join(CONTENT_DIR, filename), "utf8");
  const { data, content } = matter(file);
  const fallback = fallbackTitle(data.title, filename);
  const imported = readImported(filename.replace(/\.md$/, ""));

  const source: Source = imported
    ? { kind: "imported", report: imported }
    : !isPdfOnly(content)
      ? { kind: "markdown", report: readMarkdownReport(parseReport(content), fallback) }
      : { kind: "pdf" };

  const tags = Array.isArray(data.tags)
    ? data.tags.filter((tag: unknown): tag is string => typeof tag === "string" && tag.trim() !== "")
    : [];

  return {
    slug: getCanonicalSlug(filename),
    fallbackTitle: fallback,
    description: typeof data.description === "string" ? data.description.trim() : "",
    tags,
    pdf: findEmbeddedPdf(content, pdfFiles) || findMatchingPdf(filename, pdfFiles),
    protocol: protocols.get(filename.replace(/\.md$/, "")) ?? null,
    source,
  };
}

function summarize(report: LoadedReport): ReportSummary {
  const { slug, tags, source } = report;
  const slugYear = slug.match(/^(\d{4})-/);
  const base = {
    slug,
    tags,
    date: slugMonth(slug),
    sortDate: isoDateFromSlug(slug) || "",
    year: slugYear ? Number(slugYear[1]) : null,
  };

  if (source.kind === "pdf") {
    return {
      ...base,
      title: report.fallbackTitle,
      client: report.protocol ?? report.fallbackTitle,
      nsloc: null,
      days: null,
      issueCount: null,
      severityCounts: {},
      search: [report.fallbackTitle, report.protocol ?? "", ...tags].join(" ").toLowerCase(),
    };
  }

  const facts =
    source.kind === "imported"
      ? {
          title: source.report.title || report.fallbackTitle,
          client:
            source.report.protocolName || source.report.title || source.report.repo.split("/")[1],
          start: parseIsoDate(source.report.startDate),
          finish: parseIsoDate(source.report.finishDate),
          nsloc: source.report.nsloc,
          findings: source.report.issues,
          searchable: [source.report.repo, ...source.report.repositories, ...source.report.auditors],
        }
      : {
          title: source.report.title,
          client: source.report.protocol,
          start: source.report.start,
          finish: source.report.finish,
          nsloc: source.report.nsloc,
          findings: source.report.findings,
          searchable: [
            ...source.report.repositories.map((repository) => repository.label),
            ...source.report.auditors,
          ],
        };

  // The search looks at names only (report, client, repositories, auditors,
  // tags): with the protocol overview in it, "den" also found every report
  // whose overview says "widen" or "independent".

  return {
    ...base,
    title: facts.title,
    client: report.protocol ?? facts.client,
    date: facts.finish ? compactDate(facts.finish) : base.date,
    sortDate: facts.finish ? isoDate(facts.finish) : base.sortDate,
    year: facts.finish ? facts.finish.year : base.year,
    nsloc: facts.nsloc,
    days: auditDays(facts.start, facts.finish),
    issueCount: facts.findings.length,
    severityCounts: countSeverities(facts.findings),
    search: [facts.title, report.protocol ?? "", facts.client, ...facts.searchable, ...tags]
      .join(" ")
      .toLowerCase(),
  };
}

const markdownFiles = () =>
  fs.readdirSync(CONTENT_DIR).filter((file) => file.endsWith(".md"));

const pdfFiles = () => fs.readdirSync(PDF_DIR);

/** Every report, the most recent first. */
export function getReportSummaries(): ReportSummary[] {
  const pdfs = pdfFiles();
  const protocols = protocolOverrides();
  return markdownFiles()
    .map((file) => summarize(loadReport(file, pdfs, protocols)))
    .sort((a, b) => b.sortDate.localeCompare(a.sortDate) || a.title.localeCompare(b.title));
}

/** Both slug forms of every report, and the PDFs that have no markdown file. */
export function getReportSlugs(): string[] {
  const slugs = new Set<string>();
  markdownFiles().forEach((file) => getAllReportSlugs(file).forEach((slug) => slugs.add(slug)));
  pdfFiles().forEach((pdf) => {
    const slug = slugFromPdf(pdf);
    if (slug) slugs.add(slug);
  });
  return Array.from(slugs);
}

// "MM-YYYY-Name-yAudit-Report.pdf" or "YYYY-MM-Name-report.pdf" -> "YYYY-MM-Name"
function slugFromPdf(pdf: string): string | null {
  const match = pdf.replace(/\.pdf$/i, "").match(/^(\d{2}|\d{4})-(\d{2}|\d{4})-(.+)$/);
  if (!match) return null;
  const [, part1, part2, name] = match;
  const cleanName = name.replace(/-?yaudit-?report$/i, "").replace(/-?report$/i, "");
  if (part1.length === 4) return `${part1}-${part2}-${cleanName}`;
  if (part2.length === 4) return `${part2}-${part1}-${cleanName}`;
  return null;
}

// Text shown as it is, without markdown.
const textHtml = (value: string | null) => (blank(value) ? "" : escapeHtml(value.trim()));

function renderSections(
  sections: { label: string; markdown: string }[],
  math: boolean
): Promise<FindingSection[]> {
  return Promise.all(
    sections.map(async ({ label, markdown }) => ({
      label,
      html: await renderMarkdown(markdown, { math }),
    }))
  );
}

type DetailContent = Pick<
  ReportDetail,
  | "title"
  | "protocol"
  | "timeline"
  | "auditors"
  | "isoDate"
  | "overviewHtml"
  | "repositories"
  | "commits"
  | "scopeHtml"
  | "evaluations"
  | "overallAssessmentHtml"
  | "severityCounts"
  | "findings"
  | "extraSections"
  | "finalRemarksHtml"
>;

async function importedDetail(report: ImportedReport): Promise<DetailContent> {
  const start = parseIsoDate(report.startDate);
  const finish = parseIsoDate(report.finishDate);

  const findings: Finding[] = await Promise.all(
    withRefs(report.issues, (issue) => issue.number).map(async (issue) => ({
      ref: issue.ref,
      anchor: `issue-${issue.number}`,
      legacyAnchor: null,
      severity: issue.severity,
      title: issue.title || "",
      sections: await renderSections(issueSections(issue.body || ""), false),
    }))
  );

  const evaluations: Evaluation[] = report.evaluations
    .filter((evaluation) => !(blank(evaluation.score) && blank(evaluation.description)))
    .map((evaluation) => ({
      category: evaluation.category.replace(/_/g, " "),
      score: evaluation.score,
      descriptionHtml: textHtml(evaluation.description),
    }));

  return {
    title: report.title || "",
    protocol: report.protocolName || report.title || "",
    timeline: `${compactDate(start)} - ${compactDate(finish)}`,
    auditors: report.auditors,
    isoDate: finish ? isoDate(finish) : null,
    overviewHtml: textHtml(report.protocolOverview),
    repositories: report.repositories.map((url) => ({ url, label: sourceLabel(url) })),
    commits: report.commits.map((commit) => ({
      hash: commit.hash,
      url: commit.url || report.githubUrl || null,
    })),
    scopeHtml: textHtml(report.auditScope),
    evaluations,
    overallAssessmentHtml: blank(report.overallAssessment) ? null : textHtml(report.overallAssessment),
    severityCounts: countSeverities(report.issues),
    findings,
    extraSections: [],
    finalRemarksHtml: blank(report.finalRemarks) ? null : textHtml(report.finalRemarks),
  };
}

async function markdownDetail(report: MarkdownReport): Promise<DetailContent> {
  const findings: Finding[] = await Promise.all(
    report.findings.map(async (finding) => ({
      ref: finding.ref,
      anchor: `finding-${finding.ref.toLowerCase()}`,
      legacyAnchor: legacyHeadingId(finding.heading),
      severity: finding.severity,
      title: plainText(finding.title).replace(/`/g, ""),
      sections: await renderSections(markdownFindingSections(finding.markdown), true),
    }))
  );

  const usedIds = new Set([
    "overview",
    "scope",
    "severity-classification",
    "key-findings",
    "evaluation",
    "overall-assessment",
    "findings",
  ]);
  const extraSections: ExtraSection[] = await Promise.all(
    report.extras.map(async (section) => {
      const base = slugify(section.title) || "section";
      let id = base;
      for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
      usedIds.add(id);
      return { id, title: section.title, html: await renderMarkdown(section.markdown) };
    })
  );

  const evaluations: Evaluation[] = await Promise.all(
    report.matrix.map(async (row) => ({
      category: row.category,
      score: row.score,
      descriptionHtml: blank(row.description) ? "" : await renderMarkdown(row.description),
    }))
  );

  return {
    title: report.title,
    protocol: report.protocol,
    timeline:
      report.start && report.finish
        ? `${compactDate(report.start)} - ${compactDate(report.finish)}`
        : "",
    auditors: report.auditors,
    isoDate: report.finish ? isoDate(report.finish) : null,
    overviewHtml: blank(report.overview) ? "" : await renderMarkdown(report.overview),
    repositories: report.repositories,
    commits: report.commits,
    scopeHtml: blank(report.scope) ? "" : await renderMarkdown(report.scope),
    evaluations,
    overallAssessmentHtml: null,
    severityCounts: countSeverities(report.findings),
    findings,
    extraSections,
    finalRemarksHtml: blank(report.finalRemarks) ? null : await renderMarkdown(report.finalRemarks),
  };
}

const NO_CONTENT = {
  auditors: [],
  structured: false,
  overviewHtml: "",
  repositories: [],
  commits: [],
  scopeHtml: "",
  evaluations: [],
  overallAssessmentHtml: null,
  severityCounts: {},
  findings: [],
  extraSections: [],
  finalRemarksHtml: null,
};

/** The report page for a slug, or null when no report has that slug. */
export async function getReportDetail(slug: string): Promise<ReportDetail | null> {
  const pdfs = pdfFiles();
  const filename = markdownFiles().find((file) => getAllReportSlugs(file).includes(slug));

  if (!filename) {
    // A PDF without a markdown file.
    const pdf = pdfs.find((file) => slugFromPdf(file) === slug);
    if (!pdf) return null;
    const title = slug.split("-").slice(2).join(" ") || "Untitled";
    return {
      ...NO_CONTENT,
      slug,
      canonicalSlug: slug,
      isoDate: isoDateFromSlug(slug),
      title,
      description: title,
      tags: [],
      protocol: title,
      timeline: extractDate(slug) || "",
      pdfPath: `/pdf/${pdf}`,
    };
  }

  const report = loadReport(filename, pdfs, protocolOverrides());
  const pdfPath = report.pdf ? `/pdf/${report.pdf}` : null;
  const common = {
    slug: report.slug,
    canonicalSlug: report.slug,
    tags: report.tags,
    pdfPath,
  };

  if (report.source.kind === "pdf") {
    return {
      ...NO_CONTENT,
      ...common,
      isoDate: isoDateFromSlug(report.slug),
      title: report.fallbackTitle,
      description: report.description || report.fallbackTitle,
      protocol: report.protocol ?? report.fallbackTitle,
      timeline: extractDate(report.slug) || "",
    };
  }

  const content =
    report.source.kind === "imported"
      ? await importedDetail(report.source.report)
      : await markdownDetail(report.source.report);
  const title = content.title || report.fallbackTitle;

  return {
    ...content,
    ...common,
    structured: true,
    isoDate: content.isoDate || isoDateFromSlug(report.slug),
    title,
    description: report.description || title,
    protocol: report.protocol || content.protocol || title,
    timeline: content.timeline || extractDate(report.slug) || "",
  };
}
