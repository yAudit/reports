import { useState, useMemo, useEffect } from "react";
import { GetStaticProps } from "next";
import Head from "next/head";
import SearchBar from "../components/SearchBar";
import ReportCard from "../components/ReportCard";
import matter from "gray-matter";
import path from "path";
import fs from "fs";
import { extractDate, SITE_URL, getCanonicalSlug } from "@/lib/utils";

interface Report {
  title: string;
  description: string;
  date: string;
  slug: string;
  tags: string[];
}

interface HomeProps {
  reports: Report[];
}

export default function Home({ reports }: HomeProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const tags = reports
    .map((report) => report.tags)
    .flat()
    .filter((tag) => tag.trim() !== "")
    .reduce((unique, tag) => {
      if (!unique.includes(tag)) unique.push(tag);
      return unique;
    }, [] as string[]);

  // Enhanced useEffect to handle multiple URL tags
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tagParam = params.get("tag");

    if (tagParam) {
      // Split the tag parameter by commas and filter out any invalid tags
      const urlTags = tagParam
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tags.includes(tag));

      if (urlTags.length > 0) {
        // This client-only effect hydrates state from the URL after SSR.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedTags(urlTags);
      }
    }
  }, [tags]);

  const filteredReports = useMemo(() => {
    const query = searchQuery?.toLowerCase();
    return reports
      .filter(
        (report) =>
          report?.title?.toLowerCase().includes(query) ||
          report?.description?.toLowerCase().includes(query) ||
          report?.tags?.some((tag) => tag.toLowerCase().includes(query))
      )
      .filter((report) => {
        if (selectedTags.length === 0) return true;
        return report.tags.some((tag) => selectedTags.includes(tag));
      });
  }, [searchQuery, reports, selectedTags]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Enhanced tag selection handler for multiple tags
  const handleTagSelection = (tag: string) => {
    setSelectedTags((prevTags) => {
      const newTags = prevTags.includes(tag)
        ? prevTags.filter((t) => t !== tag)
        : [...prevTags, tag];

      // Update URL with all selected tags
      const params = new URLSearchParams(window.location.search);
      if (newTags.length > 0) {
        params.set("tag", newTags.join(","));
      } else {
        params.delete("tag");
      }

      // Update URL without refreshing the page
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${
          newTags.length ? `?${params.toString()}` : ""
        }`
      );

      return newTags;
    });
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
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0 mb-8 text-gray-400">
          <SearchBar onSearch={handleSearch} />
          <div className="flex flex-wrap gap-2 mx-auto mt-4 justify-center">
            {tags.map((tag, index) => (
              <button
                key={index}
                className={
                  "inline-flex items-center px-2.5 py-0.5 text-md font-medium bg-deepblue/10 text-deepblue hover:bg-deepblue/5 duration-700" +
                  (selectedTags.includes(tag)
                    ? " bg-deepblue/20 text-deepblue"
                    : "")
                }
                onClick={() => handleTagSelection(tag)}
              >
                {tag} {selectedTags.includes(tag) && "x"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-6 px-4 sm:px-0 sm:grid-cols-2 lg:grid-cols-3">
          {filteredReports.length > 0 ? (
            filteredReports.map((report, index) => (
              <ReportCard key={index} {...report} />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500">
                {searchQuery
                  ? "No reports found matching your search."
                  : "No reports available."}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    const reportsDirectory = path.join(process.cwd(), "content");
    const filenames = fs.readdirSync(reportsDirectory);

    const reports = filenames
      .filter((filename) => filename.endsWith(".md"))
      .map((filename) => {
        const filePath = path.join(reportsDirectory, filename);
        const fileContent = fs.readFileSync(filePath, "utf8");
        const { data: frontmatter } = matter(fileContent);
        const fallbackDate = new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
        });

        return {
          slug: getCanonicalSlug(filename),
          title:
            (frontmatter.title &&
              frontmatter.title?.split("-").slice(2).join(" ")) ||
            filename,
          date: extractDate(filename.replace(".md", "")) || fallbackDate,
          description:
            typeof frontmatter.description === "string"
              ? frontmatter.description
              : "",
          tags: Array.isArray(frontmatter.tags)
            ? frontmatter.tags.filter(
                (tag: unknown): tag is string =>
                  typeof tag === "string" && tag.trim().length > 0
              )
            : [],
        };
      })
      .sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });

    return {
      props: {
        reports,
      },
      // Revalidate every hour
      revalidate: 3600,
    };
  } catch (error) {
    console.error("Error fetching reports:", error);
    return {
      props: {
        reports: [],
      },
      revalidate: 3600,
    };
  }
};
