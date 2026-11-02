import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sparron reads her prompt from disk at runtime; make sure Vercel ships it.
  outputFileTracingIncludes: {
    "/api/sparron": ["./prompts/sparron.md"],
    "/api/sparron/**": ["./prompts/sparron.md"],
  },
};

export default nextConfig;
