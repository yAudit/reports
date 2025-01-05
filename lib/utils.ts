/* eslint-disable @typescript-eslint/no-explicit-any */
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import remarkGfm from "remark-gfm";
// import { Node } from 'unist';
import { visit } from "unist-util-visit";

import { unified } from "unified";
import remarkParse from "remark-parse";

function generateTableOfContents(content: string) {
  const headings: { depth: number; text: string; id: string; section: string }[] = [];
  let startCounting = false;  // Flag to start counting from Review Summary
  
  // Parse the markdown content
  const ast = unified()
    .use(remarkParse)
    .parse(content);

  // Collect all headings and organize them hierarchically
  let currentSection = '';
  visit(ast, 'heading', (node: any) => {
    const text = node.children
      .filter((child: any) => child.type === 'text')
      .map((child: any) => child.value)
      .join('');

    // Skip "Table of Contents" heading
    if (text.toLowerCase().includes('table of contents')) {
      return;
    }

    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');

    if (node.depth === 2) {
      currentSection = text;
    }

    headings.push({
      depth: node.depth,
      text,
      id,
      section: currentSection
    });
  });

  // Generate TOC markdown
  const tocLines: string[] = [];
  let sectionCount = 0;
  // Removed subsection letters

  headings
    .filter(h => {
      // Skip h1 headings and "Table of Contents" at any level
      return h.depth > 1 && !h.text.toLowerCase().includes('table of contents');
    })
    .forEach((h) => {
      let currentLetterIndex = 0;
      if (h.depth === 2) {
        // Start counting from Review Summary
        if (h.text.toLowerCase().includes('review summary')) {
          startCounting = true;
        }
        if (startCounting) {
          sectionCount++;
          currentLetterIndex = 0;
          tocLines.push(`${sectionCount}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href="#${h.id}">${h.text}</a>`);
        }
      } else if (h.depth === 3 && startCounting) {
        // Add URL for nested items and indent
        tocLines.push(`&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href="#${h.id}">${h.text}</a>`);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        currentLetterIndex++;
      }
    });

  // Convert lines to HTML format with proper breaks
  const tocHtml = tocLines
    .map(line => `<div style="margin-bottom: 0.5rem;">${line}</div>`)
    .join('');
  return tocHtml;
}

// Plugin to add IDs to headings
function remarkHeadingIds() {
  return (tree: any) => {
    visit(tree, 'heading', (node) => {
      const text = node.children
        .filter((child: any) => child.type === 'text')
        .map((child: any) => child.value)
        .join('');
      
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');

      // Add HTML attributes to the heading
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

  // Process markdown and replace image URLs
  const processedContent = await remark()
    .use(remarkGfm)
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

// interface ImageNode extends Node {
//   type: 'image';
//   url: string;
//   title: string | null;
//   alt: string | null;
// }

// function replaceImageUrls() {
//   const REPO_OWNER = 'abdul-majeed-khan'; // Replace with your GitHub username
//   const REPO_NAME = 'reports-website';
//   const BRANCH = 'main';

//   return (tree: Node) => {
//     visit(tree, 'image', (node: ImageNode) => {
//       const url = node.url;
//       if (url.startsWith('./') || url.startsWith('/')) {
//         // Remove leading slash and 'content/reports' from path
//         const cleanPath = url
//           .replace(/^\//, '')
//           .replace(/^\.\//, '')
//           .replace(/^content\/reports\//, '');

//         node.url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/content/reports/${cleanPath}`;
//       }
//     });
//   };
// }
