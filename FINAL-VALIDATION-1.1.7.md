# SORTIO 1.1.7 — final validation

Datum: 8. 9. 2026

## Stav

Funkční kandidát 1.1.7 pro uživatelské ověření. Změny z kola „zasedací plán + Výukový panel“ jsou implementovány ve zdrojové i school-server variantě.

## Ověřené změny

- Losování a projekce nezobrazují technické hlášky o cyklu; interní výběr bez opakování zůstává zachován.
- Navigace používá označení „Zasedací plán“.
- Zasedací plán má mřížkový editor skutečného tvaru učebny (10 × 16), podporuje různě dlouhé řady, mezery a uličky a počítá kapacitu z označených míst.
- Vlastní tvar se ukládá jako `custom` a pracuje s konkrétními souřadnicemi míst.
- U zasedacího plánu zůstává projekce a přímý export PDF A4 naležato; samostatné tlačítko Tisk je odstraněno.
- Tlačítko Promítnout ve Výukovém panelu je vizuálně primární.
- Miniatury barevných pozadí mají vlastní viditelné náhledy.
- Wikimedia pozadí se vykresluje jako sanitizovaná obrazová vrstva v pracovní ploše i projekci.
- Vyčištění panelu ve fullscreen režimu nepoužívá systémový `confirm()` a neukončuje fullscreen.
- D6 má větší a více roztažené puntíky.
- Čerstvé lokální úložiště bez předchozí bezpečné kopie není chybně označeno jako varování.

## Automatické kontroly

- `npm test`: PASS.
- UX regressions 1.1.7: 26/26 PASS.
- Package 3 runtime včetně nepravidelného vlastního tvaru učebny: PASS.
- GHRAB Platform conformance: 108/108 PASS.
- P3 quality/performance: 43/43 PASS.
  - entryCriticalBytes: 543671 / 550000
  - largestFileBytes: 258859 / 270000
  - precacheBytes: 737763 / 800000
- XSS sink regression: PASS; `innerHTML` 28 při baseline 29.
- P3 browser contract: PASS.
- Error reporter statická/regresní část: 51 PASS / 0 FAIL.
- `dist-school-server/`: sestaven pro 1.1.7 a obsahuje i lazy moduly zasedacího plánu a PDF exportu.

## Omezení validačního prostředí

Kompletní lokální `qa:p5` runtime audit přes HTTP nelze v tomto pracovním prostředí dokončit, protože spravovaná politika Chromium `URLBlocklist` blokuje testovací lokální stránky. Jde o omezení validačního prostředí, nikoli zjištěný aplikační FAIL. Ostatní browserové a GARP harnessy, které používají kompatibilní způsob spuštění, prošly. Plný P5 runtime gate má být znovu proveden v GitHub CI / podporovaném validačním prostředí před produkčním vydáním.
