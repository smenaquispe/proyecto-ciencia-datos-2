import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // NEXT_PUBLIC_API_URL: "https://major-camels-type.loca.lt",
  },
  allowedDevOrigins: [
  'arrogant-chamber-regally.ngrok-free.dev'
  ],
};

export default nextConfig;
