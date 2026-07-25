import type { NextConfig } from "next";

const nextConfig: NextConfig = {
env: {
    NEXT_PUBLIC_API_URL: "https://slow-bees-say.loca.lt",
  },
  allowedDevOrigins: [
  'arrogant-chamber-regally.ngrok-free.dev'
  ],
};

export default nextConfig;
