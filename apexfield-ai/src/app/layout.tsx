import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ApexField AI — Every Technician, A Master Technician.",
  description:
    "Real-time multimodal AI field coaching for HVAC fleets. Reads OEM data plates, talks techs through diagnostics hands-free, enforces safety checks, and writes the service report.",
  openGraph: {
    title: "ApexField AI — Every Technician, A Master Technician.",
    description:
      "Real-time multimodal AI field coaching that turns day-one HVAC hires into autonomous, high-margin technicians.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0F19",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-[#0B0F19] font-sans text-ink">{children}</body>
    </html>
  );
}
