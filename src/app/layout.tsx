import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Onest } from "next/font/google";
import "./globals.css";

const ui = Onest({ variable: "--font-ui", subsets: ["latin"] });
const poster = Big_Shoulders({ variable: "--font-poster", weight: ["700", "800", "900"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Grimoire · Planary Casino",
  description: "A poker run in eight chapters. Play hands, score points times mult, break the seal, write sigils in the book.",
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
  /**
   * Added to a home screen, Grimoire launches with no browser chrome at all.
   *
   * On an iPhone this is not a nicety, it is the only way: Safari implements
   * the Fullscreen API on iPad and not on iPhone, so a page there cannot ask
   * for the whole screen however politely. A home-screen launch can simply
   * have it. `black-translucent` then lets the game run under the status bar
   * rather than beside it, which is what the safe-area insets are for.
   */
  appleWebApp: { capable: true, title: "Grimoire", statusBarStyle: "black-translucent" },
  /**
   * Next emits the standardised `mobile-web-app-capable`, which iOS only began
   * honouring in 16.4. The vendor-prefixed one is what every iPhone before
   * that reads, and it costs one line to keep them working.
   */
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  /**
   * Without this the page stops at the notch — and, less obviously, every
   * `env(safe-area-inset-*)` in the stylesheet silently resolves to zero,
   * which had quietly made all of the landscape inset handling dead code.
   */
  viewportFit: "cover",
  /** So the browser's own bars are the colour of the table, not of a browser. */
  themeColor: "#1f0710",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ui.variable} ${poster.variable}`}>
      <body>{children}</body>
    </html>
  );
}
