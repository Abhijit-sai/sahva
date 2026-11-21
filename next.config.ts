import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg", "@livekit/rtc-node"],
  distDir: process.env.SAHVA_TEST_RUN ? ".next-e2e" : ".next",
  turbopack: { root: process.cwd() },
  allowedDevOrigins: ['127.0.0.1','localhost'],
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "microphone=(self), camera=()" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
