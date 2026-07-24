# Architektura SORTIO 1.0.2

SORTIO je modulární local-first PWA. Uživatelské rozhraní, doménové algoritmy, datová vrstva, projekce, tisk a diagnostika jsou oddělené tak, aby šly samostatně testovat.

## Vrstvy

1. jádro, utility, kryptograficky kvalitní náhodný výběr a centrální zachycení chyb;
2. datový trezor v5, migrace, sanitizace, záchranná kopie a ověřené zálohy;
3. třídy, import z IS, docházka a slovník oprav diakritiky;
4. losování bez opakování;
5. chytré skupiny a závazná pravidla;
6. role, témata a zasedací pořádek;
7. historie zapojování a spravedlivý výběr;
8. třídní nástroje;
9. bezpečná projekční vrstva;
10. lokální tiskové/PDF výstupy;
11. produkční diagnostika, přístupnost, PWA a AI Studio bridge;
12. GHRAB QA 1.0.2.

## Datový trezor v5

- hlavní klíč: `sortio.data.v5`;
- poslední bezpečný stav: `sortio.data.v5.last-good`;
- vratný stav před importem: `sortio.data.v5.pre-import`;
- lokální kopie poškozeného primárního zápisu: `sortio.data.v5.corrupt`;
- automatická migrace z `sortio.data.v2`, `v3` a `v4`;
- limity délky textů, počtu studentů, míst a historie při sanitizaci;
- dvoukrokové ukládání s předchozím ověřeným stavem v `last-good` (localStorage neposkytuje transakce);
- záloha `sortio-backup-v4` s kontrolním součtem FNV-1a pro detekci náhodného poškození;
- maximální importovaný soubor 5 MB.

Kontrolní součet není elektronický podpis. Chrání proti náhodnému poškození, nikoli proti úmyslné změně souboru.

## PWA a přístupová brána

Service worker ukládá vlastní prostředky SORTIO pro rychlé načítání a instalaci aplikace. Samotné spuštění však zůstává bezpečně uzavřené: centrální brána AI Studia musí ověřit přístup online. Plnohodnotný offline start bude možné doplnit až tehdy, pokud centrální brána vydá časově omezený a kryptograficky ověřitelný token; obyčejný záznam v `localStorage` se jako oprávnění nepoužívá.

## Soukromí

E-mailové adresy se zpracují pouze v paměti otevřeného importního dialogu. Datový model ukládá jména a učitelská nastavení, nikoli adresy. Diagnostika vypisuje pouze počty, technický stav a anonymizované chybové zprávy.

## Výkon

Produkční kontrola ověřuje rozdělení 120 smyšlených studentů do 30 čtveřic. Sanitizace podporuje až 500 studentů v jedné třídě, přestože běžné školní použití je výrazně menší.

## Moduly

Verze 1.0.2 obsahuje 30 JavaScriptových modulů v `src/js/`. Produkční vrstvu tvoří zejména:

- `20-state-storage.js` – datový trezor v5;
- `92-production-tools.js` – demo, kontrola a diagnostický export;
- `93-keyboard-accessibility.js` – klávesové ovládání;
- `94-runtime-health.js` – online/offline a stav úložiště;
- `95-diagnostics.js` – anonymizovaný technický snímek.
