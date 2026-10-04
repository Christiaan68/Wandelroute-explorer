/**
 * Measurement ID voor Google Analytics 4 (bv. "G-XXXXXXXXXX"), ingesteld via
 * de environment variable NEXT_PUBLIC_GA_MEASUREMENT_ID (zie .env.example).
 * Zonder deze waarde laadt src/components/Analytics.tsx helemaal niets van
 * Google, ook niet na toestemming — zo blijft analytics volledig uit tijdens
 * lokaal ontwikkelen tenzij je er zelf voor kiest een ID in te vullen.
 */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
