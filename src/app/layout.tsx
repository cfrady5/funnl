import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "srchr — see what search is costing you",
  description:
    "srchr is a search intelligence platform that audits your website, SEO, paid search, landing pages, and conversion tracking to find what is blocking visibility and conversions. srchr.xyz",
  metadataBase: new URL("https://srchr.xyz"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
