import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ambl/types", "@ambl/database", "@ambl/providers"],
};

export default nextConfig;