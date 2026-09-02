# Wandelroute Explorer

Een mobielvriendelijke webapp/PWA om een rondwandeling te vinden op een
zelfgekozen afstand, met live gps-navigatie en gesproken afslag-instructies
tijdens het wandelen.

## Architectuur in het kort

- **Next.js 14 (App Router) + TypeScript**, met Tailwind CSS voor de styling.
- **Kaart:** [MapLibre GL JS](https://maplibre.org/) met gratis, key-loze
  vector tiles van [OpenFreeMap](https://openfreemap.org/).
- **Routing:** [openrouteservice](https://openrouteservice.org/) (profiel
  `foot-walking`) achter een eigen adapterlaag
  (`src/lib/routing/provider.ts`). Alle ORS-specifieke request/response-
  vertaling zit uitsluitend in `src/lib/routing/ors-provider.ts` — de rest
  van de app kent alleen de generieke `RoutingProvider`-interface. Wil je
  later overstappen naar GraphHopper, Valhalla of een andere dienst? Schrijf
  dan een nieuwe klasse die `RoutingProvider` implementeert en registreer
  hem in `src/lib/routing/index.ts`. De rest van de app hoeft niet te
  veranderen.
- **Rondwandeling genereren:** gebruikt ORS's ingebouwde `round_trip`-optie
  (genereert een lus van ongeveer de gevraagde lengte vanaf één startpunt).
  `src/lib/route-generation/engine.ts` roept de provider herhaald aan met
  wisselende seeds/richtingen, corrigeert de gevraagde lengte als de uitkomst
  buiten de marge valt, berekent een overlapscore t.o.v. eerder afgewezen
  routes (`src/lib/routing/similarity.ts`, gebaseerd op steekproefpunten
  langs de route) en sorteert geschikte kandidaten op afstandsafwijking,
  ondergrondvoorkeur en variatie.
- **Adres zoeken:** [Nominatim](https://nominatim.org/) (OpenStreetMap),
  geproxyd via `src/app/api/geocode` (nodig voor een correcte User-Agent
  conform het Nominatim-gebruiksbeleid).
- **Opslag:** IndexedDB (via `idb`) voor wandelgeschiedenis, achter een
  `WalksRepository`-interface (`src/lib/storage/walks-repository.ts`). Later
  een backend/gebruikersaccounts toevoegen betekent: een nieuwe
  implementatie van die interface schrijven (bv. `RestWalksRepository`), en
  in `getWalksRepository()` de keuze wisselen. Instellingen (spraak aan/uit
  e.d.) staan in `localStorage` via Zustand's `persist`-middleware.
- **State:** [Zustand](https://github.com/pmndrs/zustand) voor de
  zoek-/voorstel-flow (`planner-store.ts`) en instellingen
  (`settings-store.ts`).
- **Navigatielogica:** `src/lib/geo/navigation-engine.ts` bevat de pure,
  goed te testen kernlogica (voortgang langs de route, afwijkingsdetectie met
  hysterese, anti-herhaling voor spraak) — losgekoppeld van React/gps zodat
  het zonder browser te unit-testen is.
- **Spraak:** de browser Web Speech API (`src/lib/speech/voice.ts`).
- **PWA:** handmatig `manifest.webmanifest` + een kleine service worker
  (`public/sw.js`) die de app-shell cachet.

## Installatie

Vereist: Node.js 20+ en npm.

```powershell
cd "C:\Mijn Docs\Christiaan\mijn websites\Wandelroute explorer"
npm install
```

## Omgevingsvariabelen

Kopieer `.env.example` naar `.env.local` en vul in:

```powershell
copy .env.example .env.local
```

| Variabele | Omschrijving |
| --- | --- |
| `ROUTING_PROVIDER` | Laat op `ors` staan (enige volledig geïmplementeerde adapter). |
| `ORS_API_KEY` | Gratis aan te vragen op [openrouteservice.org/dev](https://openrouteservice.org/dev/#/signup) (kies het "Free"-plan, 2000 requests/dag). Server-side variabele; komt nooit in de browser terecht. |
| `NEXT_PUBLIC_MAP_STYLE_URL` | Kaartstijl (vector tiles). Standaard OpenFreeMap, geen key nodig. |
| `NOMINATIM_CONTACT_EMAIL` | Jouw contact-e-mailadres, verplicht door Nominatim's gebruiksbeleid. |

Zet `.env.local` **nooit** in git — dat gebeurt ook niet, want het staat al in
`.gitignore`.

## Lokaal starten

```powershell
npm run dev
```

Open <http://localhost:3000>. De eerste keer een route zoeken vraagt geen
gps-toestemming — dat gebeurt pas op het navigatiescherm, zodra je op "Nu
vertrekken" drukt (zie Privacy hieronder).

## Tests

```powershell
npm test
```

Dit draait de Vitest-suite (`tests/unit/*.test.ts`), met dekking voor:

- afstandscontrole en het corrigeren van de gevraagde lengte
  (`route-generation-engine.test.ts`);
- detectie van vergelijkbare/dubbele routes (`similarity.test.ts`,
  `route-generation-engine.test.ts`);
- opslaan en ophalen van wandelingen via IndexedDB (`walks-repository.test.ts`,
  met `fake-indexeddb`);
- voortgang langs de route en aankomstdetectie (`navigation-engine.test.ts`);
- detectie van afwijkingen van de route, met hysterese om gps-ruis te
  filteren (`navigation-engine.test.ts`);
- GPX-export (`gpx.test.ts`) en basisgeometrie (`distance.test.ts`).

## Productie-build

```powershell
npm run build
npm start
```

## Deployment (Vercel)

1. Zet dit project in een git-repository (zie hieronder) en push naar GitHub.
2. Importeer de repository in het Vercel Dashboard.
3. Zet in Vercel → Project → Settings → Environment Variables dezelfde
   variabelen als in `.env.local` (`ORS_API_KEY`, `NOMINATIM_CONTACT_EMAIL`,
   evt. `NEXT_PUBLIC_MAP_STYLE_URL`) voor Production **en** Preview.
4. Deploy. Voor de PWA-installatie op een telefoon is HTTPS vereist — dat
   regelt Vercel automatisch.

```powershell
git init
git add .
git commit -m "Initiele versie van Wandelroute Explorer"
git branch -M main
git remote add origin <jouw-github-repo-url>
git push -u origin main
```

## Bekende beperkingen (eerlijk, zoals gevraagd)

Deze app is een werkend MVP, geen visueel prototype — maar een paar dingen
zijn inherent afhankelijk van externe diensten/browsers en kunnen niet 100%
betrouwbaar worden gegarandeerd:

- **Offline werken:** de service worker cachet alleen de app-shell (HTML/CSS/
  JS/iconen), niet kaarttegels of routeberekeningen. Een route zoeken of
  herberekenen vereist dus altijd internet. Eenmaal geladen routegegevens
  (de geplande route + instructies) blijven wél beschikbaar in de
  React-state en worden periodiek weggeschreven naar `localStorage`, zodat
  een wandeling die al bezig is niet meteen verloren gaat bij een kortstondig
  netwerkprobleem of een onverwacht gesloten tabblad/app.
- **Gesproken navigatie:** de Web Speech API en de beschikbaarheid van een
  Nederlandse stem verschillen sterk per browser/besturingssysteem. Chrome
  (Android/desktop) werkt doorgaans goed; Safari/iOS is wisselend en kan een
  Engelse stem gebruiken als er geen Nederlandse beschikbaar is.
- **Ondergrond (verhard/onverhard):** gebaseerd op OpenStreetMap-tags via
  ORS's `extra_info=surface`. Niet elke weg/pad heeft een surface-tag; die
  stukken tellen mee als "onbekend" in plaats van dat we raden.
- **"Geen alternatieven meer":** betekent hier expliciet dat binnen de
  ingestelde afstandsmarge en een redelijk maximumaantal pogingen (10) geen
  voldoende verschillende route is gevonden — nooit dat wiskundig bewezen is
  dat er geen enkele route meer bestaat. Geen routingdienst kan dat
  garanderen.
- **"Nieuwe route berekenen" na afwijking:** herberekent een nieuwe
  rondwandeling vanaf je huidige positie voor de resterende afstand. Dit is
  een pragmatische vereenvoudiging van "een route naar het vervolg
  berekenen" — de nieuwe route sluit dus niet gegarandeerd exact aan op het
  resterende stuk van de oorspronkelijke route.
- **Gps-nauwkeurigheid:** afwijkingsdetectie gebruikt een tolerantie van 30 m
  en vereist 3 opeenvolgende metingen buiten die marge voordat een melding
  verschijnt (zie `OFF_ROUTE_TOLERANCE_METERS` in
  `src/lib/geo/navigation-engine.ts`) — dit voorkomt valse meldingen door
  gewone gps-ruis, maar kan in bebouwde/beboste omgevingen soms te laat of
  te vroeg reageren.
- **Kaart- en routegegevens:** afkomstig van OpenStreetMap-bijdragers en een
  routingdienst; deze kunnen onvolledig, onnauwkeurig of verouderd zijn. Zie
  ook het instellingenscherm in de app voor de volledige privacy- en
  veiligheidsuitleg die aan gebruikers wordt getoond.
- **Schermen op kleine schermen:** getest op standaard mobiele breedtes via
  responsive Tailwind-classes; er is geen fysieke toestellentest gedaan
  (niet mogelijk in deze ontwikkelomgeving).

## Mappenstructuur (belangrijkste onderdelen)

```
src/
  app/                    Schermen (App Router) + API-routes
    api/route/generate/   Server-endpoint dat de routegeneratie-engine aanroept
    api/geocode/          Server-proxy naar Nominatim
    voorstel/, navigeren/, samenvatting/, geschiedenis/, instellingen/
  components/
    screens/              De 6 hoofdschermen als client components
    MapView.tsx            MapLibre-kaartcomponent
  lib/
    routing/               RoutingProvider-interface + ORS-adapter + duplicate-detectie
    route-generation/      Generatie-engine + routebeschrijving
    geo/                   Geometrie (afstand, projectie) + navigatie-engine
    storage/                WalksRepository (IndexedDB) + crash-herstel-journaal
    state/                  Zustand-stores
    speech/                 Web Speech API-wrapper
    gpx/                    GPX-export
tests/unit/               Vitest-tests voor de bovenstaande kernlogica
```
