# Architektura SORTIO 1.1.13

SORTIO je modulární local-first PWA. Od verze 1.1 spojuje dvě rovnocenné části: **organizaci třídy** a **Výukový panel pro živou hodinu**. Uživatelské rozhraní, doménové algoritmy, datová vrstva, widgetová plocha, projekce, tisk a diagnostika zůstávají oddělené a testovatelné.

## Vrstvy

1. jádro, utility, kryptograficky kvalitní náhodný výběr a centrální zachycení chyb;
2. datový trezor v5, migrace, sanitizace, záchranná kopie a ověřené zálohy;
3. třídy, import z IS, docházka a slovník oprav diakritiky;
4. losování bez opakování;
5. chytré skupiny a závazná pravidla;
6. role, témata a zasedací pořádek;
7. historie zapojování a spravedlivý výběr;
8. widgetový Výukový panel s pracovní plochou navázanou na aktivní třídu;
9. knihovna Wikimedia Commons bez uživatelského uploadu;
10. anonymní live-poll frontend + serverový API kontrakt;
11. bezpečná projekční vrstva;
12. lokální tiskové/PDF výstupy;
13. produkční diagnostika, přístupnost, PWA a AI Studio bridge;
14. GHRAB Platform 1.1.2 + suite-session lifecycle + QA/GARP brány.

## Výukový panel

Stav panelu je součástí hlavního datového modelu `lessonBoard`. Uživatelsky platí jednoduché pravidlo: **jedna aktivní třída = jedna pracovní plocha**. Interní pole `scenes` zůstává zachováno pouze kvůli kompatibilitě datového schématu; položky jsou nyní svázány přes `classId` a nejsou uživateli prezentovány jako samostatné scény. Při přepnutí aktivní třídy se automaticky přepne i její uložená plocha. Bez vybrané třídy existuje obecná pracovní plocha.

Widget ukládá typ, pozici, rozměr, zámek, titulek, samostatné měřítko vnitřního obsahu a typově specifická data. Rozměr karty a měřítko jejího obsahu jsou záměrně oddělené, aby bylo možné například ponechat velký Timer a současně zvětšit samotné číslice.

## Knihovna obrázků

SORTIO neobsahuje upload obrázků. `88-media-library.js` je malý lazy-loader; vlastní anonymní Wikimedia Commons integrace, filtrování a řazení výsledků jsou v `lazy/media-library.js`. Do Wikimedia se neposílají jména, třídy ani jiná školní data; síťová komunikace obsahuje pouze hledaný výraz a následné načtení vybraného obrázku. URL obrázků a zdrojů jsou při ukládání omezeny sanitizací na povolené Wikimedia domény. Zdroj a licence se uchovávají spolu s obrázkem a zobrazují se i u obrazového pozadí. Pro pozadí se výsledky hodnotí podle orientace, poměru stran, rozlišení a vizuální vhodnosti; portréty, známky, mince, obrazovky, dokumenty a podobné nevhodné motivy jsou potlačeny. Samotné pozadí se vykresluje bez ořezu (`contain`) nad rozostřenou výplní (`cover`), takže je vždy vidět celý snímek bez prázdných okrajů.

## QR hlasování

Statické GitHub Pages nemohou samy sdílet stav mezi telefonem studenta a učitelskou projekcí. Proto je live poll rozdělen na:

- frontend widget v SORTIO;
- veřejnou mobilní stránku `/poll/`;
- krátkodobý same-origin serverový stav podle `docs/SORTIO-LIVE-POLL-API.md`.

Bez serveru je dostupné lokální hlasování na plátně. Po připojení školního serveru stejný widget vytvoří anonymní poll, zobrazí QR kód, synchronizuje výsledky a umí poll serverově ukončit. Kontrakt nevyžaduje jméno, e-mail ani ID studenta.

## Datový trezor v5

- hlavní kanonický klíč: `ghrab.sortio.data.v5` (přes platformní namespace alias);
- poslední bezpečný stav a vratné/kontrolní kopie zůstávají ve vlastnictví SORTIO;
- automatická migrace starších verzí dat;
- limity délek, počtů objektů a historie při sanitizaci;
- dvoukrokové ukládání s posledním ověřeným stavem;
- záloha s kontrolním součtem pro detekci náhodného poškození;
- maximální importovaný soubor 5 MB.

Kontrolní součet není elektronický podpis. Chrání proti náhodnému poškození, nikoli proti úmyslné změně souboru.

## GHRAB suite-session

SORTIO používá GHRAB Platform 1.1.2 a kontrakt `ghrab-suite-session-v1`. Při ukončení společné relace AI Studia se zabrání dalším zápisům obsahu, uklidí vlastní potenciálně osobní data a až poté se zapíše acknowledgement. Stav nového Výukového panelu je uložen uvnitř stejného aplikačního datového trezoru, takže je tímto cleanupem pokryt automaticky.

## PWA a přístupová brána

Service worker ukládá vlastní prostředky SORTIO pro rychlé načítání a instalaci aplikace. Samotné spuštění zůstává chráněné centrální přístupovou bránou AI Studia. Externí síťová oprávnění jsou omezená CSP na explicitně potřebné zdroje Wikimedia; mikrofon, kamera a geolokace zůstávají zakázané.

## Výkon

Rozšíření 1.1 zvyšuje velikost klientského balíku. Kontrolované rozpočty jsou proto pro tuto major funkční změnu nastaveny na 550 kB pro kritický vstupní balík a 800 kB pro PWA precache; limit celého dist zůstává 900 kB a největšího souboru 270 kB.

## Klíčové moduly

- `20-state-storage.js` – datový trezor v5 a sanitizace Výukového panelu;
- `87-lesson-board.js` – třídní pracovní plocha, widget engine a nástroje živé hodiny;
- `88-media-library.js` – lazy-loader knihovny obrázků;
- `lazy/media-library.js` – Wikimedia Commons vyhledávání, filtrování, estetické řazení a výběr pozadí;
- `89-live-poll.js` – učitelská část anonymního QR hlasování;
- `poll/poll.js` – veřejná hlasovací stránka pro telefon studenta;
- `85-projection.js` – bezpečná projekce;
- `92-production-tools.js` – demo, kontrola a diagnostický export;
- `95-diagnostics.js` – anonymizovaný technický snímek.
