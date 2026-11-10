import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { visit } from "unist-util-visit";

import { unified } from "unified";
import remarkParse from "remark-parse";
import rehypeStringify from "rehype-stringify";
import remarkRehype from "remark-rehype";

function remarkHeadingIds() {
  return (tree: any) => {
    visit(tree, "heading", (node) => {
      const text = node.children
        .map((child: any) => {
          if (child.type === "text") return child.value;
          if (child.type === "inlineCode") return child.value;
          return "";
        })
        .join("");

      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");

      node.data = node.data || {};
      node.data.hProperties = node.data.hProperties || {};
      node.data.hProperties.id = id;
    });
  };
}

function remarkTrimBackticks() {
  return (tree: any) => {
    visit(tree, "inlineCode", (node: any) => {
      // Convert the node to plain text if it starts and ends with backticks
      const value = node.value;
      if (
        value.startsWith("`") &&
        value.endsWith("`") &&
        value.startsWith("```") === false
      ) {

        node.value = value.slice(1, -1);
      }

      // Add classes for styling
      node.data = node.data || {};
      node.data.hProperties = {
        className: "inline-code-block",
      };
    });
  };
}

// A line break inside a paragraph is kept, as on GitHub (hardbreaks).
function remarkHardBreaks() {
  return (tree: any) => {
    visit(tree, "text", (node: any, index: number | undefined, parent: any) => {
      if (!parent || index === undefined || !node.value.includes("\n")) return;
      const nodes = node.value
        .split(/\r?\n/)
        .flatMap((value: string, line: number) =>
          line === 0 ? [{ type: "text", value }] : [{ type: "break" }, { type: "text", value }]
        );
      parent.children.splice(index, 1, ...nodes);
      return index + nodes.length;
    });
  };
}

// Leaves the tree as it is: stands in for remark-math when math is off.
function remarkNothing() {}

/**
 * Renders a markdown fragment (no frontmatter) to HTML. The findings imported
 * from GitHub issues are rendered without math, as on GitHub, where "$" is
 * mostly an amount.
 */
export async function renderMarkdown(
  markdown: string,
  { math = true }: { math?: boolean } = {}
): Promise<string> {
  // Process markdown with all plugins including image URL replacement and KaTeX
  const processedContent = await unified()
    .use(remarkParse)
    .use(math ? remarkMath : remarkNothing) // Parse math syntax
    .use(remarkGfm)
    .use(remarkHardBreaks)
    .use(remarkReplaceImageUrls) // Add the image URL replacement plugin
    .use(remarkHeadingIds)
    .use(remarkTrimBackticks)
    .use(remarkRehype, { allowDangerousHtml: true }) // Convert to rehype (HTML AST)
    .use(rehypeKatex, {
      strict: false,
      trust: true,
      macros: {
        "\\eqref": "\\href{#1}{}",
      },
      errorColor: ' #cc0000',
      throwOnError: false,
      displayMode: false,
    })
    .use(rehypeStringify, { allowDangerousHtml: true }) // Convert to HTML string
    .process(markdown);

  return processedContent.toString();
}

export function extractDate(filename: string): string | null {
  // Match pattern: "YYYY-MM" from the start of the string
  const match = filename.match(/^(\d{4})-(\d{2})/);

  if (match) {
    const [_, year, month] = match;
    // Create date object (using 1st of the month)
    const date = new Date(parseInt(year), parseInt(month) - 1, 15);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' });
  }

  return null;
}

// Interface for image nodes in the AST
interface ImageNode {
  type: "image";
  url: string;
  title: string | null;
  alt: string | null;
}

// Plugin to replace image URLs
function remarkReplaceImageUrls() {
  return (tree: any) => {
    visit(tree, "image", (node: ImageNode) => {
      const url = node.url;

      // Handle paths that start with ../public/assets/
      if (url.startsWith("../public/assets/")) {
        // Remove ../public/assets/ prefix and convert to /assets/
        node.url = url.replace("../public/assets/", "/assets/");
      }

      // Handle paths that might already start with /assets/
      else if (url.startsWith("/assets/")) {
        // Keep as is
        node.url = url;
      }
    });
  };
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

  /**
   * Given a filename (either YEAR-MONTH-NAME.md or MONTH-YEAR-NAME.md),
   * returns both possible slug formats (without .md extension):
   * [YEAR-MONTH-NAME, MONTH-YEAR-NAME]
   */
  export function getAllReportSlugs(filename: string): string[] {
    // Remove .md extension
    const base = filename.replace(/\.md$/, "");
    // Match YEAR-MONTH-NAME
    const yearMonthMatch = base.match(/^(\d{4})-(\d{2})-(.+)$/);
    if (yearMonthMatch) {
      const [, year, month, name] = yearMonthMatch;
      return [
        `${year}-${month}-${name}`,
        `${month}-${year}-${name}`,
      ];
    }
    // Match MONTH-YEAR-NAME
    const monthYearMatch = base.match(/^(\d{2})-(\d{4})-(.+)$/);
    if (monthYearMatch) {
      const [, month, year, name] = monthYearMatch;
      return [
        `${year}-${month}-${name}`,
        `${month}-${year}-${name}`,
      ];
    }
    // If not matching, just return the base
    return [base];
  }

/** Canonical site origin used for SEO tags, sitemap, and structured data. */
export const SITE_URL = "https://reports.yaudit.dev";

/**
 * Canonical slug for a report file. Report pages are served under two slug
 * variants (YEAR-MONTH-NAME and MONTH-YEAR-NAME); this returns the
 * YEAR-MONTH-NAME form so canonical URLs and the sitemap use a single shape.
 */
export function getCanonicalSlug(filename: string): string {
  return getAllReportSlugs(filename)[0];
}

/** ISO date (YYYY-MM-15) for a slug beginning with YYYY-MM, else null. */
export function isoDateFromSlug(slug: string): string | null {
  const match = slug.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-15`;
}

  /**
   * Given markdown content, find a PDF that is explicitly referenced in HTML.
   * This lets PDF-only reports use their declared embed path instead of relying
   * only on filename heuristics.
   */
  export function findEmbeddedPdf(content: string, pdfFiles: string[]): string | null {
    const pdfAttributePattern = /\b(?:data|src|href)=["']([^"']+\.pdf)["']/gi;
    const matches = content.matchAll(pdfAttributePattern);

    for (const match of matches) {
      const referencedPath = match[1].replace(/\\/g, "/");
      const referencedFilename = referencedPath.split("/").pop();

      if (!referencedFilename) {
        continue;
      }

      const exactMatch = pdfFiles.find((pdf) => pdf === referencedFilename);
      if (exactMatch) {
        return exactMatch;
      }

      const caseInsensitiveMatch = pdfFiles.find(
        (pdf) => pdf.toLowerCase() === referencedFilename.toLowerCase()
      );
      if (caseInsensitiveMatch) {
        return caseInsensitiveMatch;
      }
    }

    return null;
  }

  /**
   * Given a markdown filename, find the corresponding PDF file
   * Handles different naming conventions between markdown and PDF files
   */
  export function findMatchingPdf(mdFilename: string, pdfFiles: string[]): string | null {
    // Remove .md extension
    const base = mdFilename.replace(/\.md$/, "");

    // Match YEAR-MONTH-NAME format
    const yearMonthMatch = base.match(/^(\d{4})-(\d{2})-(.+)$/);
    if (yearMonthMatch) {
      const [, year, month, name] = yearMonthMatch;

      // Normalize the name for comparison (remove special characters, lowercase)
      const normalizeName = (str: string) =>
        str.toLowerCase()
           .replace(/[-_]/g, '')
           .replace(/\s+/g, '');

      const normalizedName = normalizeName(name);

      // Normalized name of a PDF sharing this report's date, or null otherwise
      const normalizedPdfName = (pdf: string): string | null => {
        // Extract date and name from PDF filename
        const pdfBase = pdf.replace(/\.pdf$/i, '');

        // Try different patterns
        // Pattern 1: MM-YYYY-Name or YYYY-MM-Name
        const dateMatch = pdfBase.match(/^(\d{2}|\d{4})-(\d{2}|\d{4})-(.+)$/);
        if (!dateMatch) {
          return null;
        }

        const [, part1, part2, pdfName] = dateMatch;
        // Check if dates match (either YYYY-MM or MM-YYYY)
        const datesMatch = (part1 === year && part2 === month) ||
                         (part1 === month && part2 === year);

        if (!datesMatch) {
          return null;
        }

        // Normalize, ignoring suffixes like "yAudit-Report"
        return normalizeName(
          pdfName.replace(/-?yaudit-?report$/i, '')
                 .replace(/-?report$/i, '')
        );
      };

      // Try to find matching PDFs by comparing normalized names:
      // the PDF name contains the markdown name or vice versa
      const candidates = pdfFiles.filter(pdf => {
        const candidateName = normalizedPdfName(pdf);
        return candidateName !== null &&
               (candidateName.includes(normalizedName) ||
                normalizedName.includes(candidateName));
      });

      // Prefer an exact name match. When two reports share a date, substring
      // matching alone is ambiguous and would hand, say, VMEX the PDF of
      // VMEX-incentives depending on directory order.
      const exactMatch = candidates.find(
        pdf => normalizedPdfName(pdf) === normalizedName
      );

      return exactMatch || candidates[0] || null;
    }

    return null;
  }
