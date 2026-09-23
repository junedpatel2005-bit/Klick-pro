import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.APP_URL?.trim() || "https://klickpro.com";
  const now = new Date();

  const staticRoutes = [
    "",
    "/about",
    "/services",
    "/how-it-works",
    "/for-clients",
    "/for-professionals",
    "/pricing",
    "/faq",
    "/contact",
    "/careers",
    "/blog",
    "/privacy-policy",
    "/terms",
    "/cookies",
    "/login",
    "/signup",
  ];

  return staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1.0 : route === "/services" || route === "/pricing" ? 0.8 : 0.6,
  }));
}

