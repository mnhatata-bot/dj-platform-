import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cuelance",
    short_name: "Cuelance",
    description: "Artist workspace, ticket wallet and event entry",
    start_url: "/workspace",
    display: "standalone",
    background_color: "#090b0c",
    theme_color: "#d5ff40",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
