import type { MetadataRoute } from "next";

/**
 * Genereert automatisch /sitemap.xml (Next.js-conventie). Alleen de
 * homepage is opgenomen: de overige schermen (/voorstel, /navigeren,
 * /samenvatting, /geschiedenis, /instellingen) zijn onderdelen van de
 * app-flow of persoonlijke gegevens, geen op zichzelf staande content die
 * iemand via een zoekmachine zou willen vinden (zie ook de noindex-tags op
 * die pagina's).
 *
 * Geen lastModified/changeFrequency/priority: er is geen betrouwbare bron
 * voor een echte "laatst gewijzigd"-datum (geen CMS/database voor deze
 * pagina), dus geen new Date() bij elke build invullen. changeFrequency en
 * priority zijn bij één enkele URL niet zinvol.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://www.mijnloopje.nl",
    },
  ];
}
