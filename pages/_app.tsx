import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Navbar from '../components/Navbar';
import { Space_Grotesk } from 'next/font/google'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className={spaceGrotesk.className}>
      <Navbar />
      <Component {...pageProps} />
    </main>
  );
}