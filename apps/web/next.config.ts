import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@home-dashboard/database", "@home-dashboard/integrations"],
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
