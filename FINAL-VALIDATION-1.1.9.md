# FINAL VALIDATION — SORTIO 1.1.9

Datum: 8. 9. 2026

## Ověřený rozsah změny

- vlastní mřížka kreslí dvojlavice: 1 buňka = 2 studentská místa;
- kapacita učebny se počítá podle počtu dvojlavic;
- nepravidelný tvar učebny se normalizuje a vystřeďuje v aplikaci, projekci a PDF;
- vyčištění Výukového panelu používá vlastní potvrzovací modal a zachovává fullscreen;
- tlačítko „Promítnout“ a barevné miniatury mají explicitně vynucenou viditelnou podobu;
- pozadí Wikimedia Commons jsou filtrována a řazena pro široké estetické projekční snímky;
- portréty, známky, mince, obrazovky, dokumenty a podobné motivy jsou pro pozadí potlačeny;
- hlavní obrázek pozadí se zobrazuje celý bez ořezu (`contain`) nad rozostřenou výplní;
- mediální knihovna je lazy-loaded a offline-cached.

## Výsledky finální validace

- `npm test` — PASS.
- Lesson Board regressions — **45/45 PASS**.
- UX 1.1.9 regressions — **36/36 PASS**.
- GHRAB Platform conformance — **108/108 PASS**.
- Quality/performance gate — **43/43 PASS**, 0 warnings.
- PWA precache — **758045 B / limit 800000 B**.
- Největší soubor — **255491 B / limit 270000 B**.
- XSS sink regression inventory — **PASS**, 0 failures.
- `build:school-server` — PASS.
- Browser contract / a11y / lazy-loading kontrola — PASS, 0 failed checks.

## Poznámka k prostředí

Volitelný Playwright skript `test:headless` nebyl v tomto pracovním runtime spuštěn, protože zde není nainstalovaný balíček `playwright`. Není součástí standardního `npm test`; browser-contract kontrola nad systémovým Chromiem proběhla úspěšně.
