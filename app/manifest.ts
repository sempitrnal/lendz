import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Utangz",
    short_name: "Utangz",
    description: "Lending management made simple",
    start_url: "/",
    display: "standalone",
    background_color: "#fffefa",
    theme_color: "#7c3aed",
    orientation: "portrait",
    scope: "/",
    icons: [
      {
        src: "/pwa-icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/pwa-icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["finance", "productivity"],
    prefer_related_applications: false,
  };
}
