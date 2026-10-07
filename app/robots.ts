import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.APP_URL?.trim() || "https://klickpro.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/about",
          "/services",
          "/how-it-works",
          "/pricing",
          "/faq",
          "/contact",
          "/careers",
          "/blog",
          "/for-clients",
          "/for-professionals",
          "/privacy-policy",
          "/terms",
          "/cookies",
          "/job/*",
          "/pro/*",
        ],
        disallow: [
          "/admin",
          "/admin/*",
          "/api/*",
          "/dashboard",
          "/dashboard/*",
          "/messages",
          "/messages/*",
          "/professional/*",
          "/project/*",
          "/my-jobs",
          "/my-info",
          "/client-profile",
          "/professional-profile",
          "/earnings",
          "/reports",
          "/notifications",
          "/verification",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
