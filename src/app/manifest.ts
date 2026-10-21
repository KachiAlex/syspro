import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pisairtel ERP",
    short_name: "Pisairtel",
    description: "ERP workspace for finance, operations, HR, manufacturing and POS.",
    start_url: "/tenant-admin",
    display: "standalone",
    background_color: "#0B1120",
    theme_color: "#0B1120",
    icons: [
      { src: "/pisairtel-erp-badge.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
