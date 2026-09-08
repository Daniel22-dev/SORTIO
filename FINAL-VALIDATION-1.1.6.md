# SORTIO 1.1.6 – FINAL VALIDATION

Datum: 7. 9. 2026

## Rozsah vydání

Verze 1.1.6 upravuje učitelský workflow na Přehledu, vyhledávání studentů, losování, skupiny, role a témata, projekci, zasedací pořádek a společné chování widgetů Výukového panelu. Součástí je přímý tisk zasedacího pořádku na A4 naležato s povinným logem Gymnázia, Ostrava-Hrabůvka.

## Automatické ověření

- `npm test` – PASS.
- GHRAB Platform 1.1.2 conformance – 108/108 PASS.
- Lesson board regressions – 42/42 PASS.
- SORTIO 1.1.6 UX regressions – 20/20 PASS.
- GARP suite-session – 7/7 PASS.
- GARP hostile-render – PASS.
- GARP canary sweep – PASS.
- Error reporter static/contract checks – 51 PASS / 0 FAIL.
- School-server build – PASS; `dist-school-server/` sestaven pro SORTIO 1.1.6.

## Omezení testovacího prostředí

Spravovaná politika Chromium v tomto prostředí blokuje běžnou navigaci HTTP/HTTPS/file URL (`ERR_BLOCKED_BY_ADMINISTRATOR`). Proto nebyla spuštěna samostatná prohlížečová část testu error reporteru. GARP runtime testy používají systémový Chromium přes CDP a skutečný `dist/index.html` s testovacím harness-em; příslušné runtime kontroly prošly.

## Výstup zasedacího pořádku

Tlačítko `Stáhnout PDF · A4 naležato` generuje PDF přímo v prohlížeči a stáhne jej jako soubor. Samostatné tlačítko `Tisk · A4 naležato` otevře tiskový list. Oba výstupy obsahují povinné logo školy, název školy, třídu, školní rok, datum, orientaci tabule a aktuální rozmístění žáků včetně ručních přesunů.

## Stav

Kandidát SORTIO 1.1.6 je připraven k nahrání do GitHubu a následnému ověření standardním GitHub Actions / Pages smoke testem.

## Dodatečná validace po CI hotfixu 2026-09-08
- P5 performance quality: 43/43 PASS.
- UX regrese: 21/21 PASS, včetně přímého PDF, A4 landscape, povinného loga a offline lazy modulu.
- `npm test`: PASS.
- `dist-school-server/`: znovu sestaven z opraveného zdroje.

## CI hotfix 2026-09-08 — XSS sink gate
- `npm run qa:xss`: PASS, `innerHTML` 28 <= baseline 29.
- `npm run test:lesson-board`: 42/42 PASS.
- `npm run test:ux`: 21/21 PASS.
- `npm test`: PASS včetně platformy 108/108 a GARP regresí.
- `npm run build && npm run qa:quality`: 43/43 PASS; velikostní budgety zůstávají v limitu.
- Lokální kompletní `qa:p5:ci` prošel až přes browser audit; následný runtime page test je v tomto spravovaném Chromium prostředí blokován/timeoutuje. V přiložených GitHub Actions logách stejný runtime krok před XSS auditem prošel; jediný GitHub fail byl XSS sink inventář, který je touto opravou odstraněn.
