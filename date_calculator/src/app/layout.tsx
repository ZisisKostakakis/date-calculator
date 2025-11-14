import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import React from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Date Calculator | Track Days Across Custom Periods",
  description:
    "A modern web application for calculating and tracking days across custom date ranges with configurable anchor periods. Perfect for tracking travel days, residency requirements, or time-based calculations.",
  keywords: [
    "date calculator",
    "travel days",
    "date range",
    "period tracking",
    "residency calculator",
  ],
  authors: [{ name: "Date Calculator" }],
  openGraph: {
    title: "Date Calculator",
    description:
      "Calculate and track days across custom date ranges with visual heatmaps and period validation",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
