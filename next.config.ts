import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Application authentifiée : toutes les pages sont rendues à la demande.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["exceljs"],
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  poweredByHeader: false,
};

export default nextConfig;
