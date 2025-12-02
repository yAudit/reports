import { GetStaticProps, GetStaticPaths } from "next";
import path from "path";
import fs from "fs";
import { extractDate, processMarkdown, getAllReportSlugs, findMatchingPdf } from "../lib/utils";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

interface ReportPageProps {
  title: string;
  content: string;
  date: string;
  tags: string[];
  hasPdf: boolean;
  pdfPath?: string;
  hasWebView: boolean;
}

export default function ReportPage({
  title,
  content,
  date,
  tags,
  hasPdf,
  pdfPath,
  hasWebView,
}: ReportPageProps) {
  const [viewMode, setViewMode] = useState<"html" | "pdf">(hasPdf ? "pdf" : "html");

  return (
    <main className="min-h-screen bg-gray-50 main-content">
      <article className="max-w-6xl mx-auto px-4 py-10 main-content">
        <Link href="/" className="no-print">
          <h2 className="text-xl mb-4 text-black">← Back to Reports</h2>
        </Link>

        <div className="bg-white shadow p-6 sm:px-6 main-content">
          <div className="flex lg:flex-row md:flex-row flex-col justify-between lg:items-center md:items-center gap-1 items-start mb-6 text-black no-print">
            <h1
              className="lg:text-3xl md:text-xl sm:text-md font-bold text-black"
              id={title.toLocaleLowerCase()}
            >
              {title}
            </h1>
            <div className="mt-2 flex items-center text-sm text-gray-500">
              <span>
                {date}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1.5 text-md font-medium bg-deepblue bg-opacity-10 text-deepblue"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {hasPdf && (
            <div className="mb-6 flex gap-2 no-print">
              <button
                onClick={() => setViewMode("html")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === "html"
                    ? "bg-deepblue text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Web View
              </button>
              <button
                onClick={() => setViewMode("pdf")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === "pdf"
                    ? "bg-deepblue text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                PDF View
              </button>
            </div>
          )}

          {viewMode === "html" ? (
            hasWebView ? (
              <div
                className="prose prose-md max-w-none prose-table:shadow-lg prose-table:border prose-td:p-2 prose-th:p-2 prose-th:bg-gray-100 report-content"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <p className="text-lg">Web View unavailable</p>
              </div>
            )
          ) : (
            pdfPath && (
              <div className="w-full h-screen">
                <iframe
                  src={pdfPath}
                  className="w-full h-full border-0"
                  title={`${title} PDF`}
                />
              </div>
            )
          )}
        </div>
        <div className="py-8 no-print">
          <Link href={"#" + title.toLocaleLowerCase()}>
            <h2 className="text-xl mb-4 text-black">↑ Back to Top</h2>
          </Link>
        </div>
      </article>
    </main>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const reportsDirectory = path.join(process.cwd(), "content");
  const pdfDirectory = path.join(process.cwd(), "public", "pdf");
  const mdFilenames = fs.readdirSync(reportsDirectory);
  const pdfFilenames = fs.readdirSync(pdfDirectory);

  // Generate both slug formats for each markdown file
  const slugSet = new Set<string>();
  mdFilenames
    .filter((file): file is NonNullable<typeof file> => file !== null)
    .forEach((file) => {
      getAllReportSlugs(file).forEach((slug: string) => slugSet.add(slug));
    });

  // Also generate paths for PDF-only reports
  pdfFilenames.forEach((pdfFile) => {
    const base = pdfFile.replace(/\.pdf$/i, "");
    // Extract potential slug patterns from PDF filename
    // Pattern: MM-YYYY-Name or YYYY-MM-Name
    const dateMatch = base.match(/^(\d{2}|\d{4})-(\d{2}|\d{4})-(.+)$/);
    if (dateMatch) {
      const [, part1, part2, name] = dateMatch;
      // Generate YYYY-MM-Name format slug
      if (part1.length === 4) {
        slugSet.add(`${part1}-${part2}-${name.replace(/-?yaudit-?report$/i, '').replace(/-?report$/i, '')}`);
      } else if (part2.length === 4) {
        slugSet.add(`${part2}-${part1}-${name.replace(/-?yaudit-?report$/i, '').replace(/-?report$/i, '')}`);
      }
    }
  });

  const paths = Array.from(slugSet).map((slug) => ({
    params: { slug },
  }));

  return {
    paths,
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  try {
    const slug = params?.slug as string;
    const reportsDirectory = path.join(process.cwd(), "content");
    const pdfDirectory = path.join(process.cwd(), "public", "pdf");
    const filenames = fs.readdirSync(reportsDirectory);
    const pdfFiles = fs.readdirSync(pdfDirectory);

    // Find the filename that matches the slug in either format
    let matchedFile: string | null = null;
    for (const file of filenames) {
      const slugs = getAllReportSlugs(file);
      if (slugs.includes(slug)) {
        matchedFile = file;
        break;
      }
    }

    let content = "";
    let frontMatter: any = {};
    let hasWebView = false;

    // If markdown file exists, process it
    if (matchedFile) {
      const filePath = path.join(reportsDirectory, matchedFile);
      const fileContent = fs.readFileSync(filePath, "utf8");
      const processed = await processMarkdown(fileContent);
      frontMatter = processed.frontMatter;
      content = processed.content || "";

      // Check if content is meaningful (not just an embedded PDF object)
      const hasOnlyEmbeddedPdf = content.trim().match(/^<object\s+data="pdf\//i) ||
                                 content.trim().match(/^<embed\s+src="pdf\//i);
      hasWebView = Boolean(content && content.trim().length > 0 && !hasOnlyEmbeddedPdf);
    }

    // Check if PDF exists for this report
    const matchingPdf = matchedFile
      ? findMatchingPdf(matchedFile, pdfFiles)
      : pdfFiles.find(pdf => {
          // Try to match PDF filename with slug
          const base = pdf.replace(/\.pdf$/i, "");
          const dateMatch = base.match(/^(\d{2}|\d{4})-(\d{2}|\d{4})-(.+)$/);
          if (dateMatch) {
            const [, part1, part2, name] = dateMatch;
            const cleanName = name.replace(/-?yaudit-?report$/i, '').replace(/-?report$/i, '');
            if (part1.length === 4) {
              return slug === `${part1}-${part2}-${cleanName}`;
            } else if (part2.length === 4) {
              return slug === `${part2}-${part1}-${cleanName}`;
            }
          }
          return false;
        });

    const hasPdf = matchingPdf !== null && matchingPdf !== undefined;

    // If neither markdown nor PDF exists, return 404
    if (!matchedFile && !hasPdf) {
      return { notFound: true };
    }

    const fallbackDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });

    // Extract title from slug or frontmatter
    const title = frontMatter.title?.split("-").slice(2).join(" ") ||
                  slug.split("-").slice(2).join(" ").replace(/-/g, " ") ||
                  "Untitled";

    return {
      props: {
        title,
        content: content || "",
        date: matchedFile ? (extractDate(matchedFile) || fallbackDate) : extractDate(slug) || fallbackDate,
        tags: Array.isArray(frontMatter.tags) ? frontMatter.tags : [],
        hasPdf,
        pdfPath: hasPdf ? `/pdf/${matchingPdf}` : null,
        hasWebView,
      },
      revalidate: 3600, // Revalidate every hour
    };
  } catch (error) {
    console.error("Error fetching report:", error);
    return {
      notFound: true,
    };
  }
};
