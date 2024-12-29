import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import remarkGfm from 'remark-gfm';
import { Node } from 'unist';
import { visit } from 'unist-util-visit';

interface ImageNode extends Node {
  type: 'image';
  url: string;
  title: string | null;
  alt: string | null;
}

function replaceImageUrls() {
  const REPO_OWNER = 'abdul-majeed-khan'; // Replace with your GitHub username
  const REPO_NAME = 'reports-website';
  const BRANCH = 'main';

  return (tree: Node) => {
    visit(tree, 'image', (node: ImageNode) => {
      const url = node.url;
      if (url.startsWith('./') || url.startsWith('/')) {
        // Remove leading slash and 'content/reports' from path
        const cleanPath = url
          .replace(/^\//, '')
          .replace(/^\.\//, '')
          .replace(/^content\/reports\//, '');
          
        node.url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/content/reports/${cleanPath}`;
      }
    });
  };
}

export async function processMarkdown(content: string) {
  // Parse frontmatter
  const { data, content: markdownContent } = matter(content);

  // Process markdown and replace image URLs
  const processedContent = await remark()
    .use(remarkGfm) // Add GitHub Flavored Markdown support
    .use(replaceImageUrls)
    .use(html, { 
      sanitize: false, // Allow all HTML
      allowDangerousHtml: true // Required for some GFM features
    })
    .process(markdownContent);

  return {
    frontMatter: data,
    content: processedContent.toString()
  };
}