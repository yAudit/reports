import "@/styles/globals.css";
import "katex/dist/katex.min.css";
import "@/styles/report.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>yAudit Reports</title>
      </Head>

      <div className="flex min-h-screen flex-col bg-white text-zinc-950">
        <Navbar />
        {/* flex-1 keeps the footer at the bottom of the window on short pages. */}
        <main className="flex-1">
          <Component {...pageProps} />
        </main>
        <Footer />
      </div>
    </>
  );
}
