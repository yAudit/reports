// Types and helpers shared by the report pages. Safe to import in the browser.

/** The severities the list counts and filters on, in order. */
export const SEVERITIES = ["Critical", "High", "Medium", "Low", "Informational", "Gas"] as const;

/** Undetermined comes from the older markdown reports. */
export type Severity = (typeof SEVERITIES)[number] | "Undetermined";

export type SeverityCounts = Partial<Record<Severity, number>>;

export interface ReportSummary {
  /** Canonical slug: YYYY-MM-Name */
  slug: string;
  title: string;
  /** The protocol name, or the title when the report has none. */
  client: string;
  /** "Oct 07, 2026", or "Oct 2026" when only the month is known */
  date: string;
  /** ISO date the list is sorted on */
  sortDate: string;
  year: number | null;
  nsloc: number | null;
  /** Calendar days, counting both the start and the finish day */
  days: number | null;
  /** Null when the report is only a PDF */
  issueCount: number | null;
  severityCounts: SeverityCounts;
  tags: string[];
  /** Lowercase text the search matches against */
  search: string;
}

export interface SourceLink {
  url: string;
  label: string;
}

export interface Commit {
  hash: string;
  url: string | null;
}

export interface Evaluation {
  category: string;
  score: string | null;
  descriptionHtml: string;
}

export interface FindingSection {
  label: string;
  html: string;
}

export interface Finding {
  /** "H-1" */
  ref: string;
  /** Element id of the finding */
  anchor: string;
  /** The id the finding had on the old report page, so links to it keep working. */
  legacyAnchor: string | null;
  severity: Severity | null;
  title: string;
  sections: FindingSection[];
}

export interface ExtraSection {
  id: string;
  title: string;
  html: string;
}

export interface ReportDetail {
  slug: string;
  canonicalSlug: string;
  isoDate: string | null;
  title: string;
  description: string;
  tags: string[];
  protocol: string;
  timeline: string;
  auditors: string[];
  pdfPath: string | null;
  /** False when the report is only a PDF: the page shows the PDF. */
  structured: boolean;
  overviewHtml: string;
  repositories: SourceLink[];
  commits: Commit[];
  scopeHtml: string;
  evaluations: Evaluation[];
  overallAssessmentHtml: string | null;
  severityCounts: SeverityCounts;
  findings: Finding[];
  /** Other sections of the older markdown reports (appendices, tooling...) */
  extraSections: ExtraSection[];
  finalRemarksHtml: string | null;
}

export function severityClass(severity: Severity | null): string {
  switch (severity) {
    case "Critical":
      return "border-red-500/30 bg-red-50 text-red-900";
    case "High":
      return "border-orange-500/30 bg-orange-50 text-orange-900";
    case "Medium":
      return "border-amber-500/40 bg-amber-50 text-amber-900";
    case "Low":
      return "border-blue-500/30 bg-blue-50 text-blue-900";
    case "Gas":
      return "border-emerald-500/30 bg-emerald-50 text-emerald-900";
    default:
      return "border-zinc-300 bg-zinc-50 text-zinc-700";
  }
}

export function severityAccentClass(severity: Severity | null): string {
  switch (severity) {
    case "Critical":
      return "bg-red-600";
    case "High":
      return "bg-orange-500";
    case "Medium":
      return "bg-amber-400";
    case "Low":
      return "bg-[#0657F9]";
    case "Gas":
      return "bg-emerald-500";
    default:
      return "bg-zinc-400";
  }
}

// The older markdown reports also use Medium, Fair and Moderate for the
// middle mark.
export function scoreClass(score: string | null): string {
  switch ((score || "").toLowerCase()) {
    case "excellent":
      return "border-emerald-500/30 bg-emerald-50 text-emerald-900";
    case "good":
      return "border-teal-500/30 bg-teal-50 text-teal-900";
    case "average":
    case "medium":
    case "fair":
    case "moderate":
      return "border-amber-500/40 bg-amber-50 text-amber-900";
    case "low":
      return "border-orange-500/30 bg-orange-50 text-orange-900";
    case "poor":
      return "border-red-500/30 bg-red-50 text-red-900";
    default:
      return "border-zinc-300 bg-zinc-50 text-zinc-700";
  }
}
