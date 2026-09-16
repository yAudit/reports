import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every report is generated from repository content at build time. Exporting
  // a static site keeps PDFs and Markdown out of Netlify's server function.
  output: "export",
  reactStrictMode: true,
  transpilePackages: [
    "@ant-design/icons-svg",
    "@ant-design/icons",
    "rc-util",
    "rc-pagination",
    "rc-picker",
  ],
  turbopack: {},
};

export default nextConfig;
