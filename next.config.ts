import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  transpilePackages: [
    "@ant-design/icons-svg",
    "@ant-design/icons",
    "rc-util",
    "rc-pagination",
    "rc-picker",
  ],
  webpack: (config) => {
    // Handle ES modules correctly
    config.module.rules.push({
      test: /\.(js|mjs|jsx)$/,
      resolve: {
        fullySpecified: false,
      },
    });
    return config;
  },
  // Add redirects configuration
  async redirects() {
    return [
      {
        source: '/reports/:slug',
        destination: '/:slug',
        permanent: true, // This is a 308 status code (permanent redirect)
      }
    ];
  },
  async headers() {
    return [
      {
        source: '/pdf/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: 'https://mozilla.github.io', // Only Mozilla's PDF.js
          },
        ],
      },
    ]
  },
};

export default nextConfig;
