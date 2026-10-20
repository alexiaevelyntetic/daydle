import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

// One family for the whole app: a soft, Georgia-like serif. The optical-size axis keeps small
// text sturdy and readable while large numbers and headings get the more expressive cut.
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Daydle · Live it. Love it. Do it.",
  description: "Turn everyday tasks into quests. Earn XP, level up, keep your streak.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#145f48" },
    { media: "(prefers-color-scheme: light)", color: "#a4df60" },
  ],
};

// Runs before first paint so the page never flashes the wrong theme:
// saved choice first, then the OS preference, dark by default.
const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fraunces.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
