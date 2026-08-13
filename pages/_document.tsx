import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Basic Metadata */}
        <meta charSet="utf-8" />
        {/* Per-page title, description, canonical, Open Graph and Twitter tags
            are emitted by each page's <Head> (see pages/index.tsx, [slug].tsx).
            Only site-wide identity/fallback metadata lives here. */}
        <meta name="referrer" content="origin" />
        <meta name="creator" content="yAudit Team" />
        <meta name="robots" content="follow, index" />
        <meta name="twitter:site" content="@yaudit" />
        <meta name="twitter:creator" content="@yaudit" />

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
