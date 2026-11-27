import { useMemo } from "react";
import { GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import FilterSelect from "@/components/FilterSelect";
import HeroIcon from "@/components/HeroIcon";
import { PAGE_GUTTER } from "@/lib/layout";
import { SITE_URL } from "@/lib/utils";
import { getReportSummaries } from "@/lib/reports";
import {
  ReportSummary,
  SEVERITIES,
  Severity,
  severityAccentClass,
  severityClass,
} from "@/lib/reportTypes";

// Tailwind's sm, md and lg are ranges on this site (tailwind.config.ts), so
// the breakpoints of these pages are written min-[640px]:, min-[768px]: and
// min-[1024px]:.

interface HomeProps {
  reports: ReportSummary[];
  clients: string[];
  years: number[];
}

// "tag" is not in the form: it keeps the old ?tag= links working.
type FilterKey = "q" | "client" | "year" | "severity" | "tag";
type Filters = Record<FilterKey, string>;

const FILTER_KEYS: FilterKey[] = ["q", "client", "year", "severity", "tag"];

const chipClass =
  "inline-flex items-center border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700";

// 3078 -> "3,078"
const formatCount = (count: number) => count.toLocaleString("en-US");

function matches(report: ReportSummary, filters: Filters): boolean {
  const query = filters.q.toLowerCase();
  if (query && !report.search.includes(query)) return false;
  if (filters.client && report.client !== filters.client) return false;
  if (filters.year && String(report.year) !== filters.year) return false;
  if (filters.severity && !(report.severityCounts[filters.severity as Severity] ?? 0)) return false;
  // ?tag= may list several tags, separated by commas.
  const tags = filters.tag.split(",").map((tag) => tag.trim()).filter(Boolean);
  if (tags.length && !report.tags.some((tag) => tags.includes(tag))) return false;
  return true;
}

function ReportCard({ report }: { report: ReportSummary }) {
  return (
    <Link
      href={`/${report.slug}`}
      id={`report-card-${report.slug}`}
      className="group block border border-zinc-200 bg-white transition hover:-translate-y-0.5 hover:border-zinc-950 hover:shadow-[0_22px_50px_rgba(24,24,27,0.10)]"
    >
      <article className="relative flex min-h-48 flex-col overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-[#0657F9]" />
        <div className="flex flex-1 flex-col p-4 min-[640px]:p-5">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-[0.68rem] uppercase tracking-[0.16em] text-zinc-500">
              <span>{report.date}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-300" />
              <span className="truncate">{report.client}</span>
            </div>
            <h2 className="mt-3 line-clamp-2 text-2xl font-semibold tracking-normal text-zinc-950 group-hover:text-[#0657F9] min-[640px]:text-[1.7rem]">
              {report.title}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {report.nsloc !== null && (
                <span className={chipClass}>
                  <span className="font-mono text-zinc-950">{formatCount(report.nsloc)}</span>
                  <span className="ml-1.5 tracking-[0.12em]">nSLOC</span>
                </span>
              )}
              {report.days !== null && (
                <span className={chipClass}>
                  <span className="font-mono text-zinc-950">{report.days}</span>
                  <span className="ml-1.5 uppercase tracking-[0.12em]">
                    {report.days === 1 ? "Day" : "Days"}
                  </span>
                </span>
              )}
              {report.issueCount !== null && (
                <span className={chipClass}>
                  <span className="font-mono text-zinc-950">{report.issueCount}</span>
                  <span className="ml-1.5 uppercase tracking-[0.12em]">
                    {report.issueCount === 1 ? "Issue" : "Issues"}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
            {SEVERITIES.filter((severity) => (report.severityCounts[severity] ?? 0) > 0).map(
              (severity) => (
                <span
                  key={severity}
                  className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-medium ${severityClass(severity)}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${severityAccentClass(severity)}`} />
                  {report.severityCounts[severity]} {severity}
                </span>
              )
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function Home({ reports, clients, years }: HomeProps) {
  const router = useRouter();

  // The filters live in the query string, so a filtered list can be shared.
  const filters = useMemo<Filters>(() => {
    const value = (key: FilterKey) => {
      const raw = router.query[key];
      return ((Array.isArray(raw) ? raw[0] : raw) ?? "").trim();
    };
    return {
      q: value("q"),
      client: value("client"),
      year: value("year"),
      severity: value("severity"),
      tag: value("tag"),
    };
  }, [router.query]);

  const filteredReports = useMemo(
    () => reports.filter((report) => matches(report, filters)),
    [reports, filters]
  );

  const setFilter = (key: FilterKey, value: string) => {
    const next = { ...filters, [key]: value };
    const query = Object.fromEntries(
      FILTER_KEYS.filter((name) => next[name].trim() !== "").map((name) => [name, next[name]])
    );
    router.replace({ pathname: "/", query }, undefined, { shallow: true, scroll: false });
  };

  const homeDescription =
    "Smart contract and zero-knowledge security audit reports by yAudit. Browse findings, severity ratings, and scope for DeFi and ZK protocol reviews.";
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "yAudit Reports",
      url: SITE_URL,
      description: homeDescription,
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "yAudit",
      url: "https://yaudit.dev",
      logo: `${SITE_URL}/logo.svg`,
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: reports.map((report, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: report.title,
        url: `${SITE_URL}/${report.slug}`,
      })),
    },
  ];

  return (
    <>
      <Head>
        <title>{"yAudit Reports — Smart Contract & ZK Security Audits"}</title>
        <meta name="description" content={homeDescription} />
        <link rel="canonical" href={SITE_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="yAudit Reports — Smart Contract & ZK Security Audits" />
        <meta property="og:description" content={homeDescription} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:site_name" content="yAudit Reports" />
        <meta property="og:image" content="https://yaudit.dev/twitter.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="yAudit Reports — Smart Contract & ZK Security Audits" />
        <meta name="twitter:description" content={homeDescription} />
        <meta name="twitter:image" content="https://yaudit.dev/twitter.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>
      <div className="min-h-screen bg-white text-zinc-950">
        <section className={`${PAGE_GUTTER} py-8`}>
          <h1 className="sr-only">Security audit reports</h1>
          <form
            id="report-search"
            role="search"
            onSubmit={(event) => event.preventDefault()}
            className="grid gap-3 border border-zinc-200 bg-white p-4 shadow-[0_20px_50px_rgba(24,24,27,0.05)] min-[768px]:grid-cols-[minmax(0,1fr)_12rem_10rem_12rem]"
          >
            <div className="relative">
              <HeroIcon
                name="magnifying-glass"
                className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-zinc-400"
              />
              <input
                id="report-search-q"
                // Typed text stays in the field while the URL catches up.
                key={router.isReady ? "ready" : "loading"}
                type="search"
                aria-label="Search reports"
                defaultValue={filters.q}
                onChange={(event) => setFilter("q", event.target.value)}
                placeholder="Search"
                autoComplete="off"
                className="h-12 w-full border border-zinc-300 bg-white pl-12 pr-4 text-base text-zinc-950 outline-none transition focus:border-[#0657F9]"
              />
            </div>
            <FilterSelect
              id="report-search-client"
              label="Client"
              value={filters.client}
              onChange={(value) => setFilter("client", value)}
              options={[
                { value: "", label: "All clients" },
                ...clients.map((client) => ({ value: client, label: client })),
              ]}
            />
            <FilterSelect
              id="report-search-year"
              label="Year"
              value={filters.year}
              onChange={(value) => setFilter("year", value)}
              options={[
                { value: "", label: "All years" },
                ...years.map((year) => ({ value: String(year), label: String(year) })),
              ]}
            />
            <FilterSelect
              id="report-search-severity"
              label="Severity"
              value={filters.severity}
              onChange={(value) => setFilter("severity", value)}
              options={[
                { value: "", label: "All severity" },
                ...SEVERITIES.map((severity) => ({ value: severity, label: severity })),
              ]}
            />
          </form>

          {filteredReports.length === 0 && (
            <div className="mt-10 border border-zinc-200 bg-white p-8">
              <p className="text-sm font-medium text-zinc-950">No reports found.</p>
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 gap-4 min-[768px]:grid-cols-2">
            {filteredReports.map((report) => (
              <ReportCard key={report.slug} report={report} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  const reports = getReportSummaries();
  const clients = [...new Set(reports.map((report) => report.client).filter(Boolean))].sort();
  const years = [
    ...new Set(reports.map((report) => report.year).filter((year): year is number => year !== null)),
  ].sort((a, b) => b - a);
  return { props: { reports, clients, years } };
};
