import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/generate", "/dashboard", "/settings", "/logs"],
      },
    ],
    sitemap: "https://motionboards.com/sitemap.xml",
  };
}
