import type { Config } from "tailwindcss";
import typography from '@tailwindcss/typography'

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        black: "#000000",
        deepblue: "#0055FF",
      },
    },
  },
  safelist: [
    "math",
    "math-inline",
    "math-display",
    "katex",
    "katex-display",
    "katex-html",
    "katex-mathml",
    "dark",
    "light",
  ],
  plugins: [
    typography
  ],
} satisfies Config;