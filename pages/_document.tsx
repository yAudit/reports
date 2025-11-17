import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Basic Metadata */}
        <meta charSet="utf-8" />
        <meta name="title" content="yAudit Reports" />
        <meta name="description" content="ZK & Smart Contract Security" />
        <meta
          name="keywords"
          content="yAudit, Zero Knowledge, Smart Contract Security, Blockchain Security, Ethereum, Cryptography, DeFi"
        />
        <meta name="referrer" content="origin" />
        <meta name="creator" content="yAudit Team" />
        <meta name="robots" content="follow, index" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://reports.yaudit.dev" />
        <meta property="og:title" content="yAudit" />
        <meta
          property="og:description"
          content="ZK & Smart Contract Security"
        />
        <meta property="og:site_name" content="yAudit" />
        <meta
          property="og:image"
          content="https://yaudit.dev/twitter.png"
        />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@yaudit" />
        <meta name="twitter:creator" content="@yaudit" />
        <meta name="twitter:image" content="https://yaudit.dev/twitter.png" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"
          integrity="sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV"
          crossOrigin="anonymous"
        />
      </Head>
      <body>
        <Main />

        <NextScript />
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-6ME5DJZ484"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-6ME5DJZ484');
          `}
        </Script>
      </body>
    </Html>
  );
}
