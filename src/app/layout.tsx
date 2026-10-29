import type { Metadata, Viewport } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import { Toaster } from "@/components/toaster";
import { themeScript } from "@/lib/theme";
import "./globals.css";

const firaSans = Fira_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-fira-sans", display: "swap" });
const firaCode = Fira_Code({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-fira-code", display: "swap" });

export const metadata: Metadata = {
  title: { default: "OJT Monitor", template: "%s · OJT Monitor" },
  description: "Internship attendance, daily reports, and signed approvals.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#0b2e6f" }, { media: "(prefers-color-scheme: dark)", color: "#0a1a3f" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The theme script sets data-theme before hydration, so React must not warn about it.
  return (
    <html lang="en" className={`${firaSans.variable} ${firaCode.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}<Toaster /></body>
    </html>
  );
}
