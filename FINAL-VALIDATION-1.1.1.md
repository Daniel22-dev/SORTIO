# SORTIO 1.1.1 – finální validační protokol

Datum: 2026-09-05

## Ověřeno lokálně

- `npm test` — PASS
  - GHRAB Platform 1.1.2 conformance: 108/108 PASS
  - structure: PASS
  - domain tests: PASS
  - lesson-board regressions: 42/42 PASS
  - package 3/4/5 runtime tests: PASS
  - GARP security regressions: PASS
  - GARP hostile render: PASS
  - GARP canary sweep: PASS
  - GHRAB suite-session regressions: 5/5 PASS
- `npm run test:internal` — 35/35 PASS
- `npm run qa:quality` — 43/43 PASS
  - dist: 896433 / 900000 B
  - entry critical: 545883 / 550000 B
  - precache: 789951 / 800000 B
  - largest file: 257540 / 270000 B
- `npm run qa:xss` — PASS
  - innerHTML: 28 (baseline 29)
  - insertAdjacentHTML: 0
  - outerHTML: 0
  - eval/new Function: 0
- `npm run build:school-server` — PASS

## Poznámka k vizuální QA

Lokální Playwright-only vizuální/critical gate nebyl v tomto pracovním prostředí spuštěn, protože nebylo možné dokončit instalaci dev závislosti Playwright přes síť. Nejde o PASS ani FAIL aplikace. GitHub Actions musí po nahrání zdrojů tuto CI bránu standardně spustit.

Browserové GARP testy, které používají dostupný systémový Chromium přes CDP, prošly.

## Hlavní workflow opravy 1.1.1

- kanonické školní logo bez deformujícího filtru;
- automatická bezpečná diakritika známých křestních jmen při importu z IS;
- jedna pracovní plocha pro každou aktivní třídu;
- fullscreen samotné pracovní plochy;
- oddělené myší ovládané zvětšování karty a obsahu widgetu;
- přepracovaný Timer a Visual Timer podle principu ovládání Classroomscreen;
- hodiny bez nesouvisejícího zvuku/alarmu;
- čistý semafor bez popisků;
- vizuální kostky/mince s animací;
- odstranění samostatně přidávaného Event countdownu;
- rozšířená Wikimedia Commons knihovna a opravené pozadí;
- aktualizovaná nápověda horní lišty.
