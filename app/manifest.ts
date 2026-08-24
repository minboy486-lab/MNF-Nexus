import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MNF HOLDEM",
    short_name: "MNF HOLDEM",
    description: "MNF 홀덤펍 통합 관리",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "ko",
    background_color: "#0d0b12",
    theme_color: "#0d0b12",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
