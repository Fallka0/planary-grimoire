import type { Metadata } from "next";
import { Big_Shoulders, Onest } from "next/font/google";
import "./globals.css";

const ui = Onest({ variable: "--font-ui", subsets: ["latin"] });
const poster = Big_Shoulders({ variable: "--font-poster", weight: ["700", "800", "900"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Grimoire · Planary Casino",
  description: "A poker run in eight chapters. Play hands, score points times mult, break the seal, write sigils in the book.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ui.variable} ${poster.variable}`}>
      <body>{children}</body>
    </html>
  );
}
