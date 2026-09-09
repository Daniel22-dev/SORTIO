# FINAL VALIDATION — SORTIO 1.1.13

Datum: 9. 9. 2026

## Opravená regrese
- Rozbalovací seznam **Má sedět sám** zůstává otevřený po zaškrtnutí/odškrtnutí studenta.
- Rozbalovací seznam **Má sedět vepředu** se chová stejně.
- Učitel tak může označit více studentů za sebou bez opakovaného otevírání karty.
- Preference se okamžitě ukládají local-first; pouze se při této drobné změně nevyvolává zbytečný rerender celé trasy zasedacího pořádku.
- Datový model ani formát záloh se nemění.

## Changelog
- UI i `CHANGELOG.md` obsahují přesně posledních 10 aktualizací: 1.1.13 až 1.1.4.
- Opravena duplicita označení předchozí položky: workflow zasedacího pořádku patří verzi 1.1.11, nikoli druhé položce 1.1.12.

## Automatické kontroly
- `npm test`: PASS.
- UX regressions: 44/44 PASS.
- GHRAB Platform conformance: 108/108 PASS.
- GHRAB quality budget: 43/43 PASS.
- Interní testy: 36/36 PASS.
- GARP hostile-render / canary / suite-session: PASS.
- School-server build: PASS.

## Poznámka k browser smoke testu
Do `scripts/headless-check.mjs` byl doplněn skutečný scénář, který kontroluje, že oba `<details>` seznamy zůstanou otevřené i po více checkbox změnách. V tomto pracovním prostředí nebyl samostatný Playwright headless smoke spuštěn, protože instalace lokálního balíčku Playwright byla přerušena timeoutem prostředí; standardní `npm test` a všechny výše uvedené gate však prošly.
