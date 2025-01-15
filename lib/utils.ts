/* eslint-disable @typescript-eslint/no-explicit-any */
import matter from "gray-matter";
// import { remark } from "remark";
import html from "remark-html";
import remarkGfm from "remark-gfm";
// import { Node } from 'unist';
import { visit } from "unist-util-visit";

import { unified } from "unified";
import remarkParse from "remark-parse";

function generateTableOfContents(content: string) {
  const headings: { depth: number; text: string; id: string; section: string }[] = [];
  let startCounting = false;

  const ast = unified()
    .use(remarkParse)
    .parse(content);

  let currentSection = '';
  visit(ast, 'heading', (node: any) => {
    // Generate text and HTML separately
    const plainText = node.children
      .map((child: any) => {
        if (child.type === 'text') return child.value;
        if (child.type === 'inlineCode') return child.value;
        return '';
      })
      .join('');

    // Generate HTML with styled code blocks
    const htmlText = node.children
      .map((child: any) => {
        if (child.type === 'text') return child.value;
        if (child.type === 'inlineCode') {
          return `<code class="inline-code" style="background-color: #f3f4f6; padding: 2px 4px; border-radius: 4px;">${child.value}</code>`;
        }
        return '';
      })
      .join('');

    // Skip "Table of Contents" heading
    if (plainText.toLowerCase().includes('table of contents')) {
      return;
    }

    const id = plainText
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');

    if (node.depth === 2) {
      currentSection = plainText;
    }

    headings.push({
      depth: node.depth,
      text: htmlText, // Store the HTML version with styling
      id,
      section: currentSection
    });
  });

  // Generate TOC markdown
  const tocLines: string[] = [];
  let sectionCount = 0;

  headings
    .filter(h => {
      return h.depth > 1 && !h.text.toLowerCase().includes('table of contents');
    })
    .forEach((h) => {
      let currentLetterIndex = 0;
      if (h.depth === 2) {
        if (h.text.toLowerCase().includes('review summary')) {
          startCounting = true;
        }
        if (startCounting) {
          sectionCount++;
          currentLetterIndex = 0;
          tocLines.push(`${sectionCount}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href="#${h.id}">${h.text}</a>`);
        }
      } else if (h.depth === 3 && startCounting) {
        tocLines.push(`&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href="#${h.id}">${h.text}</a>`);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        currentLetterIndex++;
      }
    });

  const tocHtml = tocLines
    .map(line => `<div style="margin-bottom: 0.5rem;">${line}</div>`)
    .join('');
  return tocHtml;
}

// Don't forget to also update the heading IDs plugin to handle code blocks
function remarkHeadingIds() {
  return (tree: any) => {
    visit(tree, 'heading', (node) => {
      const text = node.children
        .map((child: any) => {
          if (child.type === 'text') return child.value;
          if (child.type === 'inlineCode') return child.value;
          return '';
        })
        .join('');
      
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');

      node.data = node.data || {};
      node.data.hProperties = node.data.hProperties || {};
      node.data.hProperties.id = id;
    });
  };
}

export async function processMarkdown(content: string) {
  // Parse frontmatter
  const { data, content: markdownContent } = matter(content);

  // Replace TOC placeholder with generated TOC
  const contentWithToc = markdownContent.replace(
    /1\.\s*TOC\s*{:toc}/g,
    () => generateTableOfContents(markdownContent)
  );

  // Process markdown with all plugins including image URL replacement
  const processedContent = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkReplaceImageUrls)  // Add the image URL replacement plugin
    .use(remarkHeadingIds)
    .use(html, {
      sanitize: false,
      allowDangerousHtml: true
    })
    .process(contentWithToc);

  return {
    frontMatter: data,
    content: processedContent.toString()
  };
}

export function extractDate(filename: string): string | null {
  // Match pattern: "MM-YYYY" from the start of the string
  const match = filename.match(/^(\d{2})-(\d{4})/);

  if (match) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, month, year] = match;
    // Create date object (using 1st of the month)
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toISOString();
  }

  return null;
}

// Interface for image nodes in the AST
interface ImageNode {
  type: 'image';
  url: string;
  title: string | null;
  alt: string | null;
}

// Plugin to replace image URLs
function remarkReplaceImageUrls() {
  return (tree: any) => {
    visit(tree, 'image', (node: ImageNode) => {
      const url = node.url;
      
      // Handle paths that start with ../public/assets/
      if (url.startsWith('../public/assets/')) {
        // Remove ../public/assets/ prefix and convert to /assets/
        node.url = url.replace('../public/assets/', '/assets/');
      }
      
      // Handle paths that might already start with /assets/
      else if (url.startsWith('/assets/')) {
        // Keep as is
        node.url = url;
      }
    });
  };
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
