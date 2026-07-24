# SORTIO 1.0.2 – oprava pořadí GitHub Actions

Potvrzená chyba: krok `Run internal regression suite` četl `dist/tests/tests.js` dříve, než krok `Build production files` vytvořil složku `dist`.

Oprava: `node scripts/build.mjs` se nyní spouští před `node scripts/package5-internal-tests.mjs`.

Ostatní produkční soubory a funkce aplikace zůstaly beze změny.
