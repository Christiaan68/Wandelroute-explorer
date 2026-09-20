import type { MetadataRoute } from "next";

/**
 * Genereert automatisch /sitemap.xml (Next.js-conventie). Alleen publieke,
 * indexeerbare content staat hierin: de homepage en de FAQ. De overige
 * schermen (/voorstel, /navigeren, /samenvatting, /geschiedenis,
 * /instellingen) zijn onderdelen van de app-flow of persoonlijke gegevens en
 * hebben een noindex-tag (zie die pagina's), dus die horen hier niet in.
 *
 * Geen lastModified/changeFrequency/priority: er is geen betrouwbare bron
 * voor een echte "laatst gewijzigd"-datum (geen CMS/database voor deze
 * pagina's), dus geen new Date() bij elke build invullen. changeFrequency en
 * priority zijn bij zo'n klein aantal statische URL's niet zinvol.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://www.mijnloopje.nl",
    },
    {
      url: "https://www.mijnloopje.nl/faq",
    },
  ];
}
