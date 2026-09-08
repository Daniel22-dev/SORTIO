# CI hotfix 2026-09-08 — lazy production-tools / internal tests

GitHub workflow pro SORTIO 1.1.10 skončil v kroku `Run internal regression suite` na třech kontrolách:

- `import/email-not-stored`
- `production/diagnostics-privacy`
- `production/demo`

## Příčina

Od 1.1.10 jsou produkční diagnostika, anonymní demo třída a související privacy deklarace záměrně v lazy modulu `lazy/production-tools.js`, aby hlavní bundle zůstal pod výkonovým budgetem. Interní regresní sada ale agregovala pouze `index.html` a `app.js`, takže přesunutý kód neviděla a vyhodnotila tři kontroly jako FAIL.

Nešlo o regresi runtime chování ani o ukládání e-mailových adres.

## Oprava

`src/tests/tests.js` nyní do interního produkčního textového povrchu zahrnuje také `lazy/production-tools.js`. Funkční kód aplikace se kvůli testu nevrací do hlavního bundle a lazy-loading zůstává zachován.
