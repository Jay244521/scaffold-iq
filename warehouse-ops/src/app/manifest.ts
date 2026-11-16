import type { MetadataRoute } from "next";

/** Lets people add Warehouse Ops to their phone's home screen and open it like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Warehouse Ops",
    short_name: "Warehouse Ops",
    description: "Receiving and inventory exception management.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#10294a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Report exception", url: "/incidents/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }],
  };
}
