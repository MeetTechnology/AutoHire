import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AutoHire | Global Expert Application",
  description:
    "Editorial-style expert application flow for GESF invitees, including resume review, supplemental information, detailed analysis, and supporting materials.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={sans.variable}>{children}</body>
    </html>
  );
}
