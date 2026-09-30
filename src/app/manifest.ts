import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CreatorOS — Social Media Manager",
    short_name: "CreatorOS",
    description: "All-in-One Social Media Management Platform for Content Creators",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fffbeb",
    theme_color: "#b45309",
    lang: "id",
    categories: ["productivity", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Postingan baru", url: "/content/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Live Center", url: "/live", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Analitik", url: "/analytics", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
