import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s · Cross-Border Reconciliation Agent",
    default: "Cross-Border Reconciliation Agent",
  },
  description:
    "The seller's AI agent that reconciles every PayPal payment, explains every mismatch, and acts — inside hard guardrails. PayPal sandbox × AG Grid × AG Studio.",
  applicationName: "Cross-Border Reconciliation Agent",
  openGraph: {
    title: "Cross-Border Reconciliation Agent",
    description:
      "The seller's AI agent that reconciles every PayPal payment, explains every mismatch, and acts — inside hard guardrails.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
