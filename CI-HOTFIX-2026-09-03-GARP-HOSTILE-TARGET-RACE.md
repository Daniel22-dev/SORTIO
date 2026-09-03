# CI hotfix 2026-09-03 — GARP hostile-render CDP target race

## Příčina
GitHub Actions běh nad verzí 1.0.16 skončil v `scripts/garp-hostile-render.mjs` výjimkou `TypeError: Cannot read properties of undefined (reading 'webSocketDebuggerUrl')`. Chromium už odpovídal na `/json/version`, ale seznam `/json` v daném okamžiku ještě neobsahoval target typu `page`. Harness provedl jednorázové čtení a bez kontroly dereferencoval výsledek `find()`.

## Oprava
- `waitJson()` nyní umí čekat nejen na HTTP odpověď, ale i na splnění podmínky nad JSON odpovědí.
- Hostile-render harness čeká, dokud `/json` skutečně neobsahuje `page` target s `webSocketDebuggerUrl`.
- Při nedostupnosti targetu skončí deterministickou chybou `Chromium debug timeout`, nikoli TypeErrorem.
- `garp-security-regressions.mjs` nově hlídá přítomnost této readiness ochrany.

## Rozsah změny
Jde pouze o CI/testovací infrastrukturu. Produkční zdroj `src/` ani bezpečnostní chování aplikace se nemění a aplikační verze zůstává 1.0.16.
