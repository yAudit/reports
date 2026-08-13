// Generates SEO/AIO artifacts into public/ at build time:
//   sitemap.xml, robots.txt, llms.txt, reports.json
//
// The content/ markdown is the source of truth. Slug and PDF-matching logic
// mirrors lib/utils.ts (getAllReportSlugs, getCanonicalSlug, findMatchingPdf,
// findEmbeddedPdf) so generated URLs match exactly what the pages serve.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const PDF_DIR = path.join(ROOT, "public", "pdf");
const PUBLIC_DIR = path.join(ROOT, "public");
const SITE_URL = "https://reports.yaudit.dev";

// --- slug / date helpers (mirror lib/utils.ts) ---
function canonicalSlugsFor(filename) {
  const base = filename.replace(/\.md$/, "");
  const yearMonth = base.match(/^(\d{4})-(\d{2})-(.+)$/);
  if (yearMonth) {
    const [, year, month, name] = yearMonth;
    return [`${year}-${month}-${name}`, `${month}-${year}-${name}`];
  }
  const monthYear = base.match(/^(\d{2})-(\d{4})-(.+)$/);
  if (monthYear) {
    const [, month, year, name] = monthYear;
    return [`${year}-${month}-${name}`, `${month}-${year}-${name}`];
  }
  return [base];
}

function canonicalSlugFor(filename) {
  return canonicalSlugsFor(filename)[0];
}

function isoDateFromSlug(slug) {
  const m = slug.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-15` : null;
}

function formatDateDisplay(slug) {
  const m = slug.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, 15).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

const normalizeName = (str) =>
  str.toLowerCase().replace(/[-_]/g, "").replace(/\s+/g, "");

function findMatchingPdf(mdFilename, pdfFiles) {
  const base = mdFilename.replace(/\.md$/, "");
  const yearMonth = base.match(/^(\d{4})-(\d{2})-(.+)$/);
  if (!yearMonth) return null;
  const [, year, month, name] = yearMonth;
  const want = normalizeName(name);

  const normalizedPdfName = (pdf) => {
    const pdfBase = pdf.replace(/\.pdf$/i, "");
    const dateMatch = pdfBase.match(/^(\d{2}|\d{4})-(\d{2}|\d{4})-(.+)$/);
    if (!dateMatch) return null;
    const [, part1, part2, pdfName] = dateMatch;
    const datesMatch =
      (part1 === year && part2 === month) || (part1 === month && part2 === year);
    if (!datesMatch) return null;
    return normalizeName(
      pdfName.replace(/-?yaudit-?report$/i, "").replace(/-?report$/i, "")
    );
  };

  const candidates = pdfFiles.filter((pdf) => {
    const candidateName = normalizedPdfName(pdf);
    return (
      candidateName !== null &&
      (candidateName.includes(want) || want.includes(candidateName))
    );
  });
  const exactMatch = candidates.find((pdf) => normalizedPdfName(pdf) === want);
  return exactMatch || candidates[0] || null;
}

function findEmbeddedPdf(content, pdfFiles) {
  const pattern = /\b(?:data|src|href)=["']([^"']+\.pdf)["']/gi;
  for (const match of content.matchAll(pattern)) {
    const referenced = match[1].replace(/\\/g, "/");
    const filename = referenced.split("/").pop();
    if (!filename) continue;
    const exact = pdfFiles.find((pdf) => pdf === filename);
    if (exact) return exact;
    const caseInsensitive = pdfFiles.find(
      (pdf) => pdf.toLowerCase() === filename.toLowerCase()
    );
    if (caseInsensitive) return caseInsensitive;
  }
  return null;
}

// Canonical (YEAR-MONTH-NAME) slug for a PDF-only report, matching getStaticPaths.
function pdfCanonicalSlug(pdfFile) {
  const base = pdfFile.replace(/\.pdf$/i, "");
  const dateMatch = base.match(/^(\d{2}|\d{4})-(\d{2}|\d{4})-(.+)$/);
  if (!dateMatch) return null;
  const [, part1, part2, name] = dateMatch;
  const clean = name.replace(/-?yaudit-?report$/i, "").replace(/-?report$/i, "");
  if (part1.length === 4) return `${part1}-${part2}-${clean}`;
  if (part2.length === 4) return `${part2}-${part1}-${clean}`;
  return null;
}

function titleFromSlug(slug) {
  const parts = slug.split("-");
  if (/^\d{4}$/.test(parts[0]) && /^\d{2}$/.test(parts[1])) {
    return parts.slice(2).join(" ").replace(/-/g, " ");
  }
  return slug.replace(/-/g, " ");
}

// --- gather reports (markdown first, then PDF-only) ---
const mdFiles = fs.existsSync(CONTENT_DIR)
  ? fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"))
  : [];
const pdfFiles = fs.existsSync(PDF_DIR)
  ? fs.readdirSync(PDF_DIR).filter((f) => /\.pdf$/i.test(f))
  : [];

const bySlug = new Map();

for (const file of mdFiles) {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, file), "utf8");
  const { data: frontmatter } = matter(raw);
  const slug = canonicalSlugFor(file);
  const title =
    (typeof frontmatter.title === "string" &&
      frontmatter.title.split("-").slice(2).join(" ")) ||
    titleFromSlug(slug);
  const description =
    typeof frontmatter.description === "string" && frontmatter.description.trim()
      ? frontmatter.description
      : "";
  const tags = Array.isArray(frontmatter.tags)
    ? frontmatter.tags.filter((t) => typeof t === "string" && t.trim())
    : [];
  const embedded = findEmbeddedPdf(raw, pdfFiles);
  const matched = embedded || findMatchingPdf(file, pdfFiles);
  bySlug.set(slug, {
    slug,
    title,
    description,
    tags,
    isoDate: isoDateFromSlug(slug),
    date: formatDateDisplay(slug),
    pdf: matched ? `/pdf/${matched}` : null,
  });
}

for (const pdf of pdfFiles) {
  const slug = pdfCanonicalSlug(pdf);
  if (!slug || bySlug.has(slug)) continue;
  bySlug.set(slug, {
    slug,
    title: titleFromSlug(slug),
    description: "",
    tags: [],
    isoDate: isoDateFromSlug(slug),
    date: formatDateDisplay(slug),
    pdf: `/pdf/${pdf}`,
  });
}

const reports = [...bySlug.values()].sort((a, b) => {
  const da = a.isoDate || "";
  const db = b.isoDate || "";
  return db.localeCompare(da);
});

// --- emitters ---
const xmlEscape = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const mdEscape = (s) => String(s).replace(/[\[\]\\]/g, "\\$&");

function buildSitemap() {
  const home = `  <url>\n    <loc>${SITE_URL}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`;
  const entries = reports.map((r) => {
    const lastmod = r.isoDate ? `\n    <lastmod>${r.isoDate}</lastmod>` : "";
    return `  <url>\n    <loc>${SITE_URL}/${xmlEscape(r.slug)}</loc>${lastmod}\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[home, ...entries].join("\n")}\n</urlset>\n`;
}

function buildRobots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}

function buildReportsJson() {
  return (
    JSON.stringify(
      reports.map((r) => ({
        slug: r.slug,
        url: `${SITE_URL}/${r.slug}`,
        title: r.title,
        description: r.description,
        date: r.date,
        isoDate: r.isoDate,
        tags: r.tags,
        pdf: r.pdf ? `${SITE_URL}${r.pdf}` : null,
      })),
      null,
      2
    ) + "\n"
  );
}

function buildLlmsTxt() {
  const lines = reports.map((r) => {
    const meta = [r.date, r.tags.join(", ")].filter(Boolean).join(" · ");
    const desc = r.description ? ` — ${r.description}` : "";
    return `- [${mdEscape(r.title)}](${SITE_URL}/${r.slug})${
      meta ? ` (${meta})` : ""
    }${desc}`;
  });
  return `# yAudit Reports

> Smart contract and zero-knowledge security audit reports by yAudit.
> Each report documents scope, findings, and severity ratings for DeFi and ZK protocol reviews.

## Reports

${lines.join("\n")}

## Links

- [yAudit website](https://yaudit.dev)
- [Machine-readable report index](${SITE_URL}/reports.json)
- [XML sitemap](${SITE_URL}/sitemap.xml)
`;
}

// --- write ---
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
const outputs = {
  "sitemap.xml": buildSitemap(),
  "robots.txt": buildRobots(),
  "reports.json": buildReportsJson(),
  "llms.txt": buildLlmsTxt(),
};
for (const [name, content] of Object.entries(outputs)) {
  fs.writeFileSync(path.join(PUBLIC_DIR, name), content, "utf8");
}

console.log(
  `[seo] generated sitemap.xml, robots.txt, llms.txt, reports.json (${reports.length} reports)`
);
