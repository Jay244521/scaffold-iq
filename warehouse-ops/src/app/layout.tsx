import type { Metadata, Viewport } from "next";
import "./globals.css";

// Every page depends on the signed-in user, so never serve a cached/prerendered copy.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Warehouse Ops", template: "%s · Warehouse Ops" },
  description: "Receiving and inventory exception management for warehouses, distributors and 3PLs.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Warehouse Ops", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#10294a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
