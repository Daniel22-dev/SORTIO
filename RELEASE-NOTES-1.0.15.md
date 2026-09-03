# SORTIO 1.0.15 — GARP 2.3 opravný bezpečnostní kandidát

Datum: 3. 9. 2026

Opravné kolo po nezávislé kontrole kandidáta 1.0.14. Pedagogické workflow ani datový formát se nemění.

## Bezpečnostní opravy

- N-02 / RT-07 / RT-08 / SIM-08: importované persistentní identifikátory jsou centrálně normalizovány na omezenou bezpečnou znakovou sadu a délku; neplatné identifikátory dostávají deterministickou bezpečnou náhradu, aby zůstaly zachovány vazby mezi studenty, skupinami, místy a historií.
- N-01 / RT-15 / SIM-04: ochrana proti souběžnému zápisu rozlišuje neinicializovaný stav od známého prázdného úložiště, takže karta otevřená nad prázdným stavem nesmí přepsat data vytvořená v jiné kartě.
- Přidána synchronizace mezi kartami přes událost `storage`; při externí změně se načte novější stav a UI dostane explicitní informaci o změně.
- N-03 / RT-13: statická CSP je jediným zdrojem pro build meta-CSP na aplikaci, manuálu i interním testovacím centru; build selže při neplatném nebo nepoužitelném profilu. Na všech třech chráněných HTML vstupech je fail-closed klientský frame guard pro cross-origin iframe jako defense-in-depth pro GitHub Pages.
- N-04 / RT-18: odstraněn neaktivní profil `deployment.school-server-p0.json` s `direct-provider` / lokálními provider klíči; bezpečnostní regrese nyní kontroluje všechny distribuované `deployment*.json` profily.
- N-05: reporterové souhrnné testy používají skutečné výsledkové podmínky místo bezpodmínečných PASS položek.
- N-06: browserové QA skripty používají společné vyhledání Chromia včetně Playwright cache.
- Volné adversariální hledání / RT-08: import nyní fail-closed odmítne zálohu s duplicitními interními identifikátory po sanitizaci, aby dvě entity nemohly sdílet stejné ID a následné akce nezasáhly nesprávný záznam.

## Známá omezení

- Produkční statická CSP stále vyžaduje `unsafe-inline` kvůli současné architektuře inline bootstrapu a stylů. To není považováno za konečný cílový stav.
- GitHub Pages neposílá `frame-ancestors` ani ekvivalentní serverovou hlavičku pro tento projekt; klientský frame guard je pouze doplňková ochrana. Plná serverová browser-boundary kontrola zůstává pro školní server.
- Centrální signed-permit runtime, revokace, key custody a hardening release účtů nejsou součástí tohoto ZIPu a vyžadují samostatný integrační/organizační důkaz.
