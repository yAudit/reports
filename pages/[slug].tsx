import { useEffect, useRef } from "react";
import { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import HeroIcon from "@/components/HeroIcon";
import { SITE_URL } from "@/lib/utils";
import { getReportDetail, getReportSlugs } from "@/lib/reports";
import { enhanceReportMarkdown, syncReportNavigation } from "@/lib/reportClient";
import {
  Finding,
  ReportDetail,
  SEVERITIES,
  Severity,
  scoreClass,
  severityAccentClass,
  severityClass,
} from "@/lib/reportTypes";

// Tailwind's sm, md and lg are ranges on this site (tailwind.config.ts), so
// the breakpoints of these pages are written min-[640px]:, min-[768px]: and
// min-[1024px]:.

interface ReportPageProps {
  report: ReportDetail;
}

// Same text as the Severity Classification table in the PDF report (template-tex).
const SEVERITY_CLASSIFICATION: [Severity, string, string][] = [
  ["Critical", "Immediate threat to user funds or protocol integrity", "Direct loss of funds, protocol compromise"],
  ["High", "Significant security risk requiring urgent attention", "Potential fund loss, major functionality disruption"],
  ["Medium", "Important issue that should be addressed", "Limited fund risk, functionality concerns"],
  ["Low", "Minor issue with minimal impact", "Best practice violations, minor inefficiencies"],
  [
    "Undetermined",
    "Findings whose impact could not be fully assessed within the time constraints of the engagement. These issues may range from low to critical severity, and although their exact consequences remain uncertain, they present a sufficient potential risk to warrant attention and remediation.",
    "Varies based on actual severity",
  ],
  ["Gas", "Findings that can improve the gas efficiency of the contracts.", "Increased transaction costs"],
  ["Informational", "Code quality and best practice recommendations", "Reduced maintainability and readability"],
];

const sectionClass = "scroll-mt-24 border border-zinc-200 bg-white";
const sectionHeaderClass = "border-b border-zinc-200 px-5 py-4 min-[640px]:px-7";
const sectionTitleClass = "text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500";
const tableHeadClass = "bg-zinc-50 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500";
const chipLinkClass =
  "inline-flex items-center gap-2 border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-700 hover:border-zinc-950 hover:bg-white hover:text-zinc-950";

const shortCommit = (hash: string) => (hash.length > 10 ? hash.slice(0, 10) : hash);

function navSections(report: ReportDetail): [string, string][] {
  return [
    ["overview", "Protocol Overview"],
    ["scope", "Scope"],
    ["severity-classification", "Severity Classification"],
    ["key-findings", "Key Findings"],
    ...(report.evaluations.length > 0 ? [["evaluation", "Evaluation Matrix"] as [string, string]] : []),
    ...(report.overallAssessmentHtml
      ? [["overall-assessment", "Overall Assessment"] as [string, string]]
      : []),
    ["findings", "Findings Summary"],
  ];
}

// The page sections, then one link per finding. "compact" (the sidebar)
// keeps each finding on one line and scrolls the list; otherwise (the menu
// on narrow screens) the titles wrap and the page scrolls.
function ContentsLinks({ report, compact = false }: { report: ReportDetail; compact?: boolean }) {
  return (
    <>
      {navSections(report).map(([id, label]) => (
        <a
          key={id}
          href={`#${id}`}
          data-report-nav-link
          data-section-id={id}
          className="report-nav-link block border-l border-zinc-200 px-3 py-1.5 text-zinc-600 hover:border-[#0657F9] hover:text-zinc-950"
        >
          {label}
        </a>
      ))}
      <div
        className={`mt-4 border-t border-zinc-200 pt-3 ${compact ? "max-h-[48vh] overflow-y-auto" : ""}`}
      >
        {report.findings.map((finding) => (
          <a
            key={finding.anchor}
            href={`#${finding.anchor}`}
            data-report-nav-link
            data-section-id={finding.anchor}
            title={finding.title}
            className="report-nav-link group grid grid-cols-[2.6rem_1.2rem_minmax(0,1fr)] items-baseline gap-2 border-l border-transparent px-3 py-1.5 text-zinc-600 hover:border-[#0657F9] hover:bg-[#f7f6f2] hover:text-zinc-950"
          >
            <span className="font-mono text-xs font-semibold text-zinc-950">{finding.ref}</span>
            <span className={`mt-1 h-2 w-2 rounded-full ${severityAccentClass(finding.severity)}`} />
            <span className={compact ? "truncate" : ""}>{finding.title}</span>
          </a>
        ))}
      </div>
    </>
  );
}

// Markdown, or plain text shown as a paragraph. The wrapper sets
// the size and color; .report-prose (report.css) takes them over.
function Prose({ html, className }: { html: string; className: string }) {
  return (
    <div className={className}>
      <div className="report-markdown report-prose" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function SeverityBadge({ severity, className }: { severity: Severity | null; className: string }) {
  return <span className={`${className} ${severityClass(severity)}`}>{severity || "Unclassified"}</span>;
}

function FindingArticle({ finding }: { finding: Finding }) {
  return (
    <article id={finding.anchor} className={sectionClass}>
      {finding.legacyAnchor && <span id={finding.legacyAnchor} aria-hidden="true" />}
      <header className="border-b border-zinc-200 p-5 min-[640px]:p-7">
        <div className="flex flex-col gap-4 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm font-semibold text-[#0657F9]">{finding.ref}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-300" />
              <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Finding</span>
            </div>
            <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-normal text-zinc-950">
              {finding.ref}: {finding.title}
            </h2>
          </div>
          <SeverityBadge
            severity={finding.severity}
            className="inline-flex shrink-0 border px-2.5 py-1 text-xs font-semibold"
          />
        </div>
      </header>

      <div className="space-y-8 p-5 min-[640px]:p-7">
        {finding.sections.map((section, index) => (
          <section key={`${section.label}-${index}`}>
            <h3 className="text-xl font-semibold tracking-normal text-zinc-800">{section.label}:</h3>
            <div className="report-markdown mt-4" dangerouslySetInnerHTML={{ __html: section.html }} />
          </section>
        ))}
      </div>
    </article>
  );
}

function DownloadPdf({ href }: { href: string }) {
  return (
    <a
      href={href}
      download
      className="flex w-full items-center justify-center gap-2 border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
    >
      <HeroIcon name="arrow-down-tray" className="size-4" /> Download PDF
    </a>
  );
}

function ReportContent({ report }: ReportPageProps) {
  return (
    <>
      <section id="overview" className={sectionClass}>
        <div className={sectionHeaderClass}>
          <h2 className={sectionTitleClass}>Protocol Overview</h2>
        </div>
        <Prose html={report.overviewHtml} className="p-5 text-sm leading-7 text-zinc-600 min-[640px]:p-7" />
      </section>

      <section id="scope" className={sectionClass}>
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between min-[640px]:px-7">
          <h2 className={sectionTitleClass}>Scope</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            {report.repositories.map((repository) => (
              <a key={repository.url} href={repository.url} className={`${chipLinkClass} max-w-full`}>
                <HeroIcon name="code-bracket-square" className="size-4 shrink-0" />
                <span className="truncate">{repository.label}</span>
              </a>
            ))}
            {report.commits.map((commit) => (
              <a key={commit.hash} href={commit.url ?? undefined} className={`${chipLinkClass} font-mono`}>
                <HeroIcon name="code-bracket" className="size-4 shrink-0" />
                {shortCommit(commit.hash)}
              </a>
            ))}
          </div>
        </div>
        <Prose html={report.scopeHtml} className="p-5 text-sm leading-7 text-zinc-700 min-[640px]:p-7" />
      </section>

      <section id="severity-classification" className={sectionClass}>
        <div className={sectionHeaderClass}>
          <h2 className={sectionTitleClass}>Severity Classification</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className={tableHeadClass}>
              <tr>
                <th className="whitespace-nowrap px-5 py-3">Severity</th>
                <th className="min-w-64 px-5 py-3">Description</th>
                <th className="min-w-48 px-5 py-3">Potential Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {SEVERITY_CLASSIFICATION.map(([severity, description, impact]) => (
                <tr key={severity}>
                  <td className="px-5 py-3 align-top">
                    <span className={`inline-flex border px-2.5 py-1 text-xs font-medium ${severityClass(severity)}`}>
                      {severity}
                    </span>
                  </td>
                  <td className="px-5 py-3 leading-6 text-zinc-700">{description}</td>
                  <td className="px-5 py-3 leading-6 text-zinc-700">{impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="key-findings" className={sectionClass}>
        <div className={sectionHeaderClass}>
          <h2 className={sectionTitleClass}>Key Findings</h2>
        </div>
        <div className="grid grid-cols-2 gap-px bg-zinc-200 min-[640px]:grid-cols-3 min-[1024px]:grid-cols-6">
          {SEVERITIES.map((severity) => (
            <div key={severity} className="relative bg-white p-4">
              <span className={`absolute inset-x-0 top-0 h-1 ${severityAccentClass(severity)}`} />
              <div className="font-mono text-2xl">{report.severityCounts[severity] ?? 0}</div>
              <div className={`mt-2 inline-flex border px-2 py-1 text-xs font-medium ${severityClass(severity)}`}>
                {severity}
              </div>
            </div>
          ))}
        </div>
      </section>

      {report.evaluations.length > 0 && (
        <section id="evaluation" className={sectionClass}>
          <div className={sectionHeaderClass}>
            <h2 className={sectionTitleClass}>Evaluation Matrix</h2>
          </div>
          <div className="divide-y divide-zinc-200">
            {report.evaluations.map((evaluation) => (
              <div
                key={evaluation.category}
                className="grid gap-4 p-5 min-[640px]:grid-cols-[12rem_8rem_1fr] min-[640px]:p-6"
              >
                <div className="font-medium capitalize text-zinc-950">{evaluation.category}</div>
                <div>
                  {evaluation.score && (
                    <span className={`inline-flex border px-2.5 py-1 text-xs font-medium ${scoreClass(evaluation.score)}`}>
                      {evaluation.score}
                    </span>
                  )}
                </div>
                <Prose html={evaluation.descriptionHtml} className="text-sm leading-6 text-zinc-600" />
              </div>
            ))}
          </div>
        </section>
      )}

      {report.overallAssessmentHtml && (
        <section id="overall-assessment" className={sectionClass}>
          <div className={sectionHeaderClass}>
            <h2 className={sectionTitleClass}>Overall Assessment</h2>
          </div>
          <Prose
            html={report.overallAssessmentHtml}
            className="p-5 text-sm leading-7 text-zinc-700 min-[640px]:p-7"
          />
        </section>
      )}

      <section id="findings" className={sectionClass}>
        <div className={sectionHeaderClass}>
          <h2 className={sectionTitleClass}>Findings Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className={tableHeadClass}>
              <tr>
                <th className="whitespace-nowrap px-5 py-3">Ref</th>
                <th className="whitespace-nowrap px-5 py-3">Severity</th>
                <th className="min-w-80 px-5 py-3">Title</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {report.findings.map((finding) => (
                <tr key={finding.anchor} className="hover:bg-[#f7f6f2]">
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-zinc-950">
                    <a href={`#${finding.anchor}`} className="hover:text-[#0657F9]">
                      {finding.ref}
                    </a>
                  </td>
                  <td className="px-5 py-3">
                    <SeverityBadge
                      severity={finding.severity}
                      className="inline-flex border px-2.5 py-1 text-xs font-medium"
                    />
                  </td>
                  <td className="px-5 py-3 font-medium text-zinc-950">
                    <a href={`#${finding.anchor}`} className="hover:text-[#0657F9]">
                      {finding.title}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {report.findings.map((finding) => (
        <FindingArticle key={finding.anchor} finding={finding} />
      ))}

      {report.extraSections.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-24 border border-zinc-200 bg-white p-5 min-[640px]:p-7">
          <h2 className={sectionTitleClass}>{section.title}</h2>
          <Prose html={section.html} className="mt-4 text-sm leading-7 text-zinc-700" />
        </section>
      ))}

      {report.finalRemarksHtml && (
        <section className="border border-zinc-200 bg-white p-5 min-[640px]:p-7">
          <h2 className={sectionTitleClass}>Final Remarks</h2>
          <Prose html={report.finalRemarksHtml} className="mt-4 text-sm leading-7 text-zinc-700" />
        </section>
      )}
    </>
  );
}

export default function ReportPage({ report }: ReportPageProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) enhanceReportMarkdown(contentRef.current);
    // The code frames make the page taller: scroll again to the finding in
    // the address, which the browser scrolled to before.
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) document.getElementById(hash)?.scrollIntoView();
    return syncReportNavigation();
  }, [report.slug]);

  const canonicalUrl = `${SITE_URL}/${report.canonicalSlug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: report.title,
      description: report.description,
      datePublished: report.isoDate,
      dateModified: report.isoDate,
      keywords: report.tags.join(", "),
      author: { "@type": "Organization", name: "yAudit", url: "https://yaudit.dev" },
      publisher: {
        "@type": "Organization",
        name: "yAudit",
        url: "https://yaudit.dev",
        logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.svg` },
      },
      mainEntityOfPage: canonicalUrl,
      url: canonicalUrl,
      ...(report.pdfPath
        ? {
            encoding: {
              "@type": "MediaObject",
              contentUrl: `${SITE_URL}${report.pdfPath}`,
              encodingFormat: "application/pdf",
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Reports", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: report.title, item: canonicalUrl },
      ],
    },
  ];

  const details: [string, string][] = [
    ["Protocol", report.protocol],
    ["Timeline", report.timeline],
    ...(report.structured || report.auditors.length > 0
      ? [["Audit Team", report.auditors.join(", ")] as [string, string]]
      : []),
  ];

  return (
    <>
      <Head>
        <title>{`${report.title} | yAudit Reports`}</title>
        <meta name="description" content={report.description} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={report.title} />
        <meta property="og:description" content={report.description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="yAudit Reports" />
        <meta property="og:image" content="https://yaudit.dev/twitter.png" />
        {report.isoDate && <meta property="article:published_time" content={report.isoDate} />}
        {report.tags.map((tag) => (
          <meta key={`tag-${tag}`} property="article:tag" content={tag} />
        ))}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={report.title} />
        <meta name="twitter:description" content={report.description} />
        <meta name="twitter:image" content="https://yaudit.dev/twitter.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>
      <div className="min-h-screen bg-white text-zinc-950">
        <section className="border-b border-zinc-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-5 min-[640px]:px-6 min-[1024px]:px-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-950"
            >
              <HeroIcon name="arrow-left" className="size-4" /> Reports
            </Link>

            <div className="mt-8 min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Smart Contract Security Assessment
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-normal text-zinc-950 min-[640px]:text-5xl min-[1024px]:text-6xl">
                {report.title}
              </h1>
              <dl className="mt-5 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-sm">
                {details.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</dt>
                    <dd className="text-zinc-950">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 min-[640px]:px-6 min-[1024px]:grid-cols-[18rem_1fr] min-[1024px]:px-8">
          <aside className="hidden min-[1024px]:block">
            <div className="sticky top-24 space-y-4">
              {report.structured && (
                <nav
                  className="border border-zinc-200 bg-white p-4 text-sm shadow-[0_20px_50px_rgba(24,24,27,0.06)]"
                  data-report-nav
                >
                  <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Contents
                  </p>
                  <ContentsLinks report={report} compact />
                </nav>
              )}
              {report.pdfPath && <DownloadPdf href={report.pdfPath} />}
            </div>
          </aside>

          <div ref={contentRef} className="min-w-0 space-y-8">
            {report.structured ? (
              <>
                {/* On narrow screens the contents fold into a menu, closed until
                    tapped. A link closes it before the page scrolls, so the
                    section lands at the top instead of the menu's height
                    further down. */}
                <details
                  className="group border border-zinc-200 bg-white min-[1024px]:hidden"
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a")) event.currentTarget.open = false;
                  }}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 [&::-webkit-details-marker]:hidden">
                    Contents
                    <HeroIcon name="chevron-down" className="size-4 transition group-open:rotate-180" />
                  </summary>
                  <nav className="border-t border-zinc-200 p-4 text-sm" data-report-nav>
                    <ContentsLinks report={report} />
                  </nav>
                </details>
                <ReportContent report={report} />
              </>
            ) : (
              report.pdfPath && (
                <section className="border border-zinc-200 bg-white">
                  <iframe
                    src={report.pdfPath}
                    title={`${report.title} PDF report`}
                    className="block h-[85vh] w-full"
                  />
                </section>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: getReportSlugs().map((slug) => ({ params: { slug } })),
  // Reports only change when this repository is redeployed, so there is no
  // need for a runtime fallback (and therefore no server function).
  fallback: false,
});

export const getStaticProps: GetStaticProps<ReportPageProps> = async ({ params }) => {
  const report = await getReportDetail(params?.slug as string);
  return report ? { props: { report } } : { notFound: true };
};
