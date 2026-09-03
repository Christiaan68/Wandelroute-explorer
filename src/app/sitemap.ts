import type { MetadataRoute } from "next";

/**
 * Genereert automatisch /sitemap.xml (Next.js-conventie). Alleen de
 * homepage is opgenomen: de overige schermen (/voorstel, /navigeren,
 * /samenvatting, /geschiedenis, /instellingen) zijn onderdelen van de
 * app-flow of persoonlijke gegevens, geen op zichzelf staande content die
 * iemand via een zoekmachine zou willen vinden.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://mijnloopje.nl",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
