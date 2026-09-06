# SORTIO 1.1.5 – FINAL VALIDATION / CI HOTFIX

Datum: 2026-09-06

## Důvod opravy

Dva GitHub Actions logy pro SORTIO 1.1.4 skončily stejným jediným selháním v `scripts/garp-suite-session-regressions.mjs`:

`Negative control neočekávaně prošel bezpečnostní podmínkou.`

Nešlo o selhání produkčního suite-session cleanupu. Předchozí negative control oslabil pouze registraci `session.onEnd()`, ale SORTIO má záměrně i nezávislé storage/pageshow/focus guardy. Ty při změně suite generation legitimně zavolaly skutečný `handleSuiteSessionEnd()` a canary uklidily. Oslabená kopie tedy nebyla ve skutečnosti dostatečně oslabená a CI vyprodukovalo falešný FAIL.

## Oprava 1.1.5

- Produkční `handleSuiteSessionEnd()`, `performSuiteSessionCleanup()` a storage ownership se funkčně nemění.
- Odhoditelná negative-control kopie nyní oslabuje přímo jediný cleanup primitive `performSuiteSessionCleanup()`.
- Všechny lifecycle cesty zůstávají aktivní; oslabená kopie ale nemůže odstranit syntetický canary.
- Produkční bezpečnostní assertion proto na oslabené kopii očekávaně FAILne.
- Následný test čisté produkční kopie musí PASS.
- Disposable kopie se vždy odstraní ve `finally`.
- Test ukládá SHA-256 produkční a oslabené kopie.

## Lokální výsledky

- `npm test`: PASS
- `verify:structure`: PASS
- domain tests: PASS
- lesson-board regressions: 42/42 PASS
- package3/package4/package5 runtime tests: PASS
- GARP security regressions: PASS
- hostile render: PASS
- canary sweep: PASS
- suite-session regressions: 7/7 PASS
  - open-child suite end: PASS
  - delayed-open replay: PASS
  - multi-tab equivalent: PASS
  - Back/Forward lifecycle equivalent: PASS
  - fail-closed: PASS
  - negative-control disabled cleanup: PASS (bezpečnostní stav oslabené kopie očekávaně FAIL)
  - restored production copy: PASS
- platform conformance: PASS
- quality budget: 43/43 PASS
- `qa:browser`: PASS
- `qa:xss`: PASS
- reporter tests: 51 PASS / 0 FAIL

## NOT TESTED / environment limitation

V tomto spravovaném prostředí Chromium blokuje lokální HTTP/file navigaci přes URLBlocklist. Proto `qa:runtime` skončilo timeoutem při načtení `index.html`; jde o environmentální omezení, nikoli potvrzený produktový FAIL. Stejné omezení blokuje browserovou část reporter testu.

`qa:axe` zde nebylo možné reprezentativně dokončit, protože `npm ci` nedokončilo instalaci závislostí v časovém limitu. GitHub Actions instaluje přesně zamčené dependencies a musí tento bod ověřit.

## Release status

1.1.5 je kandidát k opětovnému nahrání do GitHubu. Za GREEN jej považovat až po zeleném GitHub Actions P5-R2 gate a následném Pages smoke testu.

Poznámka k wave: dříve připravený AI Studio release-wave registr očekával SORTIO 1.1.4. Po dokončení a zazelenání všech child aplikací je nutné centrální AI Studio kandidát přegenerovat na skutečnou finální verzi SORTIO 1.1.5 (a případné další child hotfix verze).
