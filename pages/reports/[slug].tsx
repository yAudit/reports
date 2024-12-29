import { GetStaticProps, GetStaticPaths } from "next";

import path from 'path';
import fs from 'fs';
import { processMarkdown } from "../../lib/markdown";

interface ReportPageProps {
  title: string;
  content: string;
  author: string;
  date: string;
  tags: string[];
}

export default function ReportPage({
  title,
  content,
  author,
  date,
  tags,
}: ReportPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-black">{title}</h1>
          <div className="mt-2 flex items-center text-sm text-gray-500">
            <span>By {author}</span>
            <span className="mx-2">•</span>
            <span>{new Date(date).toLocaleDateString()}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emeraldlight bg-opacity-25 text-darkgreen"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow px-5 py-6 sm:px-6">
            <div
              className="prose prose-lg max-w-none prose-table:shadow-lg prose-table:border prose-td:p-2 prose-th:p-2 prose-th:bg-gray-100"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const reportsDirectory = path.join(process.cwd(), "content");
  const filenames = fs.readdirSync(reportsDirectory);

  const paths = filenames
    .filter((file): file is NonNullable<typeof file> => file !== null)
    .map((file) => ({
      params: { slug: file.replace(".md", "") },
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
    const filePath = path.join(reportsDirectory, `${slug}.md`);
    const fileContent = fs.readFileSync(filePath, "utf8");
    const { frontMatter, content } = await processMarkdown(fileContent);


    return {
      props: {
        title: frontMatter.title || "Untitled",
        content: content || "",
        author: frontMatter.author || "Anonymous",
        date: frontMatter.date || new Date().toISOString(),
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
