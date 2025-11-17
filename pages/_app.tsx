import "@/styles/globals.css";
import "katex/dist/katex.min.css";
import type { AppProps } from "next/app";
import Navbar from "../components/Navbar";
import { Space_Grotesk } from "next/font/google";
import Head from "next/head";
import Footer from "@/components/Footer";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>yAudit Reports</title>
      </Head>

      <main className={spaceGrotesk.className}>
        <Navbar />
        <Component {...pageProps} />
        <Footer />
      </main>
    </>
  );
}
