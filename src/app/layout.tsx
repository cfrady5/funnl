import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "SEM Command Center — Turn any website into a paid search action plan",
  description:
    "Connect your website, Google Ads, GA4, Search Console, and Tag Manager to uncover wasted spend, weak landing pages, broken tracking, and missed keyword opportunities.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
