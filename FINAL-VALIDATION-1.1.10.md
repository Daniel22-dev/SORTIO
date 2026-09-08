# SORTIO 1.1.10 — FINAL VALIDATION

Datum: 8. 9. 2026

## Rozsah změn

- Zasedací plán: editor 3 × 7 dvojlavic, 1 buňka = 2 studentská místa.
- Nové závazné pravidlo „potřebuje sedět sám“.
- Volitelná měkká preference „Kluk + holka, pokud to půjde“; kategorii zadává učitel ručně, nikdy se neodvozuje ze jména.
- Volná místa jsou barevně odlišena v hlavním nákresu, projekci i PDF.
- Zachováno centrování nepravidelného půdorysu a PDF A4 naležato.
- Knihovna pozadí: více kategorií, až tři stránky Commons, širší fallback pro chudé kategorie; obrázky zůstávají zobrazené celé bez ořezu.
- Stav aplikace: zelená/oranžová/červená signalizace podle skutečného health stavu.
- Produkční kontrola: procentuální průběh a právě prováděný krok; diagnostický modul je lazy-loaded kvůli zachování performance budgetu.
- O aplikaci: viditelný changelog; changelog doplněn i do manuálu.

## Automatické kontroly

- `npm test`: PASS.
- GHRAB Platform conformance: **108 / 108 PASS**.
- UX regrese 1.1.10: **46 / 46 PASS**.
- Lesson Board regrese: **45 / 45 PASS**.
- GHRAB P3 quality/performance: **43 / 43 PASS**, bez warningů.
- Domain, Package 3, Package 4 a Package 5 runtime testy: PASS.
- GARP security regressions: PASS.
- GARP hostile-render: PASS.
- GARP synthetic canary: PASS.
- GARP suite-session regressions: **7 / 7 PASS**.
- XSS sink regression inventory: PASS; počet `innerHTML` sinků je pod baseline.
- Centrální error reporter: **51 PASS / 0 FAIL**.
- School-server profil: sestaven úspěšně.

## Omezení testovacího prostředí

Spravovaný Chromium v tomto prostředí blokuje testovací URL pomocí `URLBlocklist`, proto nebyla spuštěna prohlížečová část testu centrálního error reporteru. Statické/runtime kontrakty reportéru prošly 51/51 kontrolami; omezení je vlastnost testovacího prostředí, nikoli změna aplikace.

Suite-session testy proto používají skutečný build a Chromium přes CDP se Storage-kompatibilním in-memory harness. V tomto režimu prošlo 7/7 scénářů; nativní transport `StorageEvent` mezi navigovanými taby a fyzický BFCache transport zůstávají omezením spravovaného prohlížeče.

## Soukromí

Párovací údaj Kluk/Holka je volitelný a lokální. Neodvozuje se automaticky ze jména, není součástí bezpečné projekce ani diagnostického protokolu. Při sdílení screenshotů, testovacích souborů nebo hlášení chyb nadále používat anonymizované/smyšlené studentské údaje.

## GitHub CI hotfix — lazy production-tools / internal tests

První publish pokus 1.1.10 skončil ve `Run internal regression suite` na `email-not-stored`, `diagnostics-privacy` a `demo`. Příčinou byl zastaralý testovací agregátor: po přesunu produkčních nástrojů do `lazy/production-tools.js` nadále prohledával jen `index.html` a `app.js`.

Oprava rozšířila interní testovací povrch o `lazy/production-tools.js`; runtime kód ani privacy chování aplikace se nemění a lazy-loading zůstává zachován.

Po opravě:
- `npm test` — PASS;
- `test:internal` — 36/36 PASS;
- `qa:quality` — 43/43 PASS;
- `build:school-server` — PASS.
