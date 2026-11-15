import type { NextConfig } from "next";
import { LEGACY_REDIRECTS } from "./src/lib/routes";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  /** Section names changed; earlier links keep working. */
  redirects() {
    return LEGACY_REDIRECTS.map((entry) => ({ ...entry, permanent: true }));
  },
};

export default nextConfig;
