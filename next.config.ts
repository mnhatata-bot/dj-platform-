import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    useTypeScriptCli: false,
  },
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/api/v1/epks/*/pdf": [
      "./node_modules/@fontsource/noto-sans-arabic/files/*400-normal.woff",
    ],
  },
};
export default nextConfig;
