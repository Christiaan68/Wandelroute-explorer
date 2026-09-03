import type { MetadataRoute } from "next";

/**
 * Genereert automatisch /robots.txt (Next.js-conventie). Staat zoekmachines
 * toe de site te doorzoeken, behalve de interne API-routes (die leveren geen
 * bruikbare/leesbare inhoud op voor een zoekresultaat).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: "https://mijnloopje.nl/sitemap.xml",
  };
}
