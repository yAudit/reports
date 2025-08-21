import { GetStaticProps, GetStaticPaths } from "next";
import path from "path";
import fs from "fs";
import { extractDate, processMarkdown, getAllReportSlugs } from "../lib/utils";
import Link from "next/link";

interface ReportPageProps {
  title: string;
  content: string;
  date: string;
  tags: string[];
}

export default function ReportPage({
  title,
  content,
  date,
  tags,
}: ReportPageProps) {
  return (
    <main className="min-h-screen bg-gray-50 main-content">
      <article className="max-w-6xl mx-auto px-4 py-10 main-content">
        <Link href="/" className="no-print">
          <h2 className="text-xl mb-4 text-black">← Back to Reports</h2>
        </Link>

        <div className="bg-white shadow p-6 sm:px-6 main-content">
          <div className="flex lg:flex-row md:flex-row flex-col justify-between lg:items-center md:items-center gap-1 items-left mb-6 text-black no-print">
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
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-md font-medium bg-emeraldlight bg-opacity-25 text-darkgreen"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <img alt="logo" src="/logo.svg" className="h-[5rem] mx-auto mb-12 lg:hidden md:hidden sm:hidden" />
          <div
            className="prose prose-md max-w-none prose-table:shadow-lg prose-table:border prose-td:p-2 prose-th:p-2 prose-th:bg-gray-100 report-content"
            dangerouslySetInnerHTML={{ __html: content }}
          />
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
  const filenames = fs.readdirSync(reportsDirectory);

  // Generate both slug formats for each file
  const slugSet = new Set<string>();
  filenames
    .filter((file): file is NonNullable<typeof file> => file !== null)
    .forEach((file) => {
      getAllReportSlugs(file).forEach((slug: string) => slugSet.add(slug));
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
    const filenames = fs.readdirSync(reportsDirectory);

    // Find the filename that matches the slug in either format
    let matchedFile: string | null = null;
    for (const file of filenames) {
      const slugs = getAllReportSlugs(file);
      if (slugs.includes(slug)) {
        matchedFile = file;
        break;
      }
    }
    if (!matchedFile) {
      return { notFound: true };
    }
    const filePath = path.join(reportsDirectory, matchedFile);
    const fileContent = fs.readFileSync(filePath, "utf8");
    const { frontMatter, content } = await processMarkdown(fileContent);

    return {
      props: {
        title: frontMatter.title?.split("-").slice(2).join(" ") || "Untitled",
        content: content || "",
        date: extractDate(matchedFile) || new Date(),
        tags: Array.isArray(frontMatter.tags) ? frontMatter.tags : [],
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
