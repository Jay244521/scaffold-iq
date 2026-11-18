import type { MetadataRoute } from "next";

/** Installable web app: techs "Add to Home Screen" and launch straight into Live AI, full screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ApexField AI",
    short_name: "ApexField",
    description: "Hands-free AI coaching for HVAC technicians in the field.",
    start_url: "/demo?mode=live",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0F19",
    theme_color: "#0B0F19",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Start a live session", url: "/demo?mode=live", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Fleet dashboard", url: "/dashboard", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
