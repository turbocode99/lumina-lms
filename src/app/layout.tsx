import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { ToastProvider } from "@/components/ui/Toast";
import { themeInitScript } from "@/components/ThemeToggle";
import { luminaConfig } from "~/lumina.config";

import "./globals.css";

/**
 * Self-hosted at build time rather than fetched from Google's CDN — one less
 * external dependency, and it works on air-gapped internal networks.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: `${luminaConfig.brand.name} — ${luminaConfig.brand.tagline}`,
    template: `%s · ${luminaConfig.brand.name}`,
  },
  description: `Internal learning platform for ${luminaConfig.brand.organization}. Courses, learning paths, and required training in one place.`,
  applicationName: luminaConfig.brand.name,
  // Internal tool — keep it out of search indexes.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8ecf3" },
    { media: "(prefers-color-scheme: dark)", color: "#23262e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Runs before paint so the stored theme wins over the default. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <a
          href="#main"
          className="neu sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[300] focus:rounded-xl focus:px-4 focus:py-2 focus:text-sm focus:font-medium"
        >
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
