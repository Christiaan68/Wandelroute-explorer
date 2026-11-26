/**
 * Versiecontrole: zorgt dat de app na een nieuwe deployment de nieuwste versie
 * toont, ook als iOS/Android een eerder geopende app of Safari-tab "uit het
 * geheugen" hervat in plaats van opnieuw te laden.
 *
 * NEXT_PUBLIC_APP_VERSION wordt tijdens de build vastgelegd (next.config.mjs).
 * /api/version geeft de versie van de deployment die NU live staat. Verschillen
 * die twee, dan draait de gebruiker een oude versie en moet de pagina opnieuw
 * geladen worden.
 */

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

/** Waarde bij lokaal ontwikkelen/bouwen (geen Vercel): nooit automatisch herladen. */
export const LOCAL_VERSION = "lokaal";

/**
 * Schermen waar herladen iets kapotmaakt dat de gebruiker niet terugkrijgt:
 * - /navigeren: lopende navigatie; na herladen moet spraak op iOS opnieuw met
 *   een tik ontgrendeld worden.
 * - /voorstel: het routevoorstel staat alleen in het geheugen (planner-store).
 * - /contact: een half getypt bericht zou verloren gaan.
 * Op die schermen wordt het herladen uitgesteld tot de gebruiker naar een
 * ander scherm gaat.
 */
const UNSAFE_PREFIXES = ["/navigeren", "/voorstel", "/contact"];

export function isSafeToReload(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return !UNSAFE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export type UpdateAction = "none" | "reload" | "defer";

/**
 * Bepaalt wat er moet gebeuren na een versiecontrole.
 * @param current        versie van de code die nu draait
 * @param latest         versie die nu live staat (uit /api/version)
 * @param pathname       huidig scherm
 * @param alreadyTriedFor versie waarvoor in deze sessie al eens herladen is
 *                        (voorkomt een eindeloze herlaadlus als de server
 *                        tijdelijk nog de oude pagina levert)
 */
export function decideUpdateAction(
  current: string,
  latest: string | null | undefined,
  pathname: string | null | undefined,
  alreadyTriedFor: string | null,
): UpdateAction {
  if (!current || current === LOCAL_VERSION) return "none";
  if (!latest || latest === current) return "none";
  if (alreadyTriedFor === latest) return "none";
  return isSafeToReload(pathname) ? "reload" : "defer";
}
