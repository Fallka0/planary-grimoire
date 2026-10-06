import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // This project sits inside ~/dev, and a stray lock file further up would
  // otherwise make Turbopack treat the home directory as the root.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
