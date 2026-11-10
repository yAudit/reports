#!/usr/bin/env node
/**
 * Imports the structured data of a report from its GitHub repository into
 * content/data/<slug>.json, next to the report's markdown file. The report pages
 * read it at build time; it is not published as a file of the site.
 *
 * A report takes part when its markdown file in content/ names the repository
 * in its frontmatter:
 *
 *   repo: yAudit/twyne-morpho-report
 *
 * The script reads the repository's config.yaml and its open issues (the
 * findings, with the severity taken from their labels). The report
 * repositories are private, so it needs a token that can read them:
 *
 *   GITHUB_TOKEN=... node scripts/import-github.mjs              # every report
 *   GITHUB_TOKEN=... node scripts/import-github.mjs 2026-08-Twyne-Morpho-Vault
 *
 * GITHUB_ACCESS_TOKEN works too, and both can live in a .env file next to
 * package.json. The PDF is not downloaded: it is already in public/pdf.
 *
 * The "Import report data" workflow (.github/workflows/import-reports.yml)
 * runs it on GitHub and commits the result.
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "content");
const DATA_DIR = path.join(ROOT, "content", "data");
const API = "https://api.github.com";

const SEVERITY_LABELS = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  informational: "Informational",
  info: "Informational",
  gas: "Gas",
};
const SEVERITY_LABEL_ORDER = Object.keys(SEVERITY_LABELS);

const EVALUATION_ORDER = [
  "access_control",
  "mathematics",
  "complexity",
  "libraries",
  "decentralization",
  "code_stability",
  "documentation",
  "monitoring",
  "testing",
];

function loadToken() {
  const fromEnv = process.env.GITHUB_TOKEN || process.env.GITHUB_ACCESS_TOKEN;
  if (fromEnv) return fromEnv;

  const envFile = path.join(ROOT, ".env");
  if (!fs.existsSync(envFile)) return null;
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const match = line.match(/^\s*(GITHUB_TOKEN|GITHUB_ACCESS_TOKEN)\s*=\s*(.+?)\s*$/);
    if (match) return match[2].replace(/^["']|["']$/g, "");
  }
  return null;
}

async function github(token, url, accept = "application/vnd.github+json") {
  const response = await fetch(url.startsWith("http") ? url : `${API}${url}`, {
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "yaudit-reports-import",
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response;
}

// Every open issue, following the pagination. Pull requests are left out.
async function fetchIssues(token, repo) {
  const issues = [];
  let url = `/repos/${repo}/issues?state=open&per_page=100`;
  while (url) {
    const response = await github(token, url);
    issues.push(...(await response.json()));
    const next = (response.headers.get("link") || "").match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return issues.filter((issue) => !issue.pull_request);
}

function parseYaml(text) {
  // gray-matter parses front matter with js-yaml, which is all a config needs.
  return matter(`---\n${text}\n---\n`).data;
}

const text = (value) => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
};

const list = (value) =>
  (Array.isArray(value) ? value : value === undefined || value === null ? [] : [value])
    .map(text)
    .filter(Boolean);

// The current template writes each commit as "Label: [hash](url)"; older
// configs list plain hashes, with their URLs at the same index in commit_urls.
function commits(hashes, urls) {
  return list(hashes).map((entry, index) => {
    const link = entry.match(/^(.*?)\s*\[`?([^\]`]+)`?\]\(([^)\s]+)\)\s*$/);
    if (link) {
      return {
        label: link[1].replace(/:\s*$/, "").trim() || null,
        hash: link[2],
        url: link[3],
      };
    }
    return { label: null, hash: entry, url: list(urls)[index] || null };
  });
}

// Configs have no required field for it: use nsloc when it is set, otherwise
// the "N lines of code" (or "N nSLOC") figure in the audit scope.
function nsloc(value, scope) {
  const parse = (raw) => {
    const count = parseInt(String(raw).replace(/,/g, ""), 10);
    return Number.isFinite(count) ? count : null;
  };
  if (value !== undefined && value !== null && value !== "") return parse(value);
  const match = (scope || "").match(/(\d[\d,]*)\s+(?:n?SLOC|lines of code)/i);
  return match ? parse(match[1]) : null;
}

function evaluations(config) {
  const scores = config.evaluation || {};
  const descriptions = config.evaluation_descriptions || {};
  const keys = [
    ...new Set([...EVALUATION_ORDER, ...Object.keys(scores), ...Object.keys(descriptions)]),
  ];
  return keys
    .map((category) => ({
      category,
      score: text(scores[category]),
      description: text(descriptions[category]),
    }))
    .filter((evaluation) => evaluation.score || evaluation.description);
}

function severity(labels) {
  const names = labels.map((label) => String(label.name || label).toLowerCase());
  const match = SEVERITY_LABEL_ORDER.find((label) => names.includes(label));
  return match ? SEVERITY_LABELS[match] : null;
}

async function importReport(token, slug, repo) {
  const repository = await (await github(token, `/repos/${repo}`)).json();
  const configResponse = await github(
    token,
    `/repos/${repo}/contents/config.yaml?ref=${encodeURIComponent(repository.default_branch)}`,
    "application/vnd.github.raw"
  );
  const config = parseYaml(await configResponse.text());
  const summary = config.review_summary || {};
  const issues = await fetchIssues(token, repo);

  const report = {
    repo,
    githubUrl: repository.html_url,
    title: text(config.title),
    protocolName: text(config.protocol_name),
    protocolOverview: text(summary.protocol_overview),
    auditScope: text(summary.audit_scope),
    overallAssessment: text(summary.overall_assessment),
    startDate: text(config.start_date),
    finishDate: text(config.finish_date),
    auditors: list(config.auditors),
    commits: commits(config.commit_hashes, config.commit_urls),
    finalCommits: commits(config.final_commit_hashes, config.final_commit_urls),
    repositories: list(config.repositories),
    auditResources: list(config.audit_resources),
    treeOfAuditedFiles: text(config.tree_of_audited_files),
    finalRemarks: text(config.final_remarks),
    nsloc: nsloc(config.nsloc, summary.audit_scope),
    evaluations: evaluations(config),
    issues: issues
      .sort((a, b) => a.number - b.number)
      .map((issue) => ({
        number: issue.number,
        title: text(issue.title),
        severity: severity(issue.labels || []),
        body: text(issue.body) || "",
      })),
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, `${slug}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function reportsWithRepo() {
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const { data } = matter(fs.readFileSync(path.join(CONTENT_DIR, file), "utf8"));
      return { slug: file.replace(/\.md$/, ""), repo: text(data.repo) };
    })
    .filter((report) => report.repo);
}

async function main() {
  const token = loadToken();
  if (!token) {
    console.error("Set GITHUB_TOKEN (or GITHUB_ACCESS_TOKEN) to a token that can read the report repositories.");
    process.exit(1);
  }

  const only = process.argv.slice(2);
  const reports = reportsWithRepo().filter((report) => only.length === 0 || only.includes(report.slug));
  const missing = only.filter((slug) => !reports.some((report) => report.slug === slug));
  for (const slug of missing) {
    console.error(`${slug}: no content/${slug}.md with a "repo:" line`);
  }

  let failed = missing.length;
  for (const { slug, repo } of reports) {
    try {
      const report = await importReport(token, slug, repo);
      console.log(`${slug}: ${repo}, ${report.issues.length} findings`);
    } catch (error) {
      failed += 1;
      console.error(`${slug}: ${repo} failed: ${error.message}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

main();
