import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ??
      "https://famous-masks-admire.loca.lt",
  },
  allowedDevOrigins: [
    'arrogant-chamber-regally.ngrok-free.dev'
  ],
};

export default nextConfig;