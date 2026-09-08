# CI hotfix 2026-09-08 – SORTIO 1.1.6 – P5 performance budget

## Příčina
GitHub Actions po nahrání SORTIO 1.1.6 selhaly ve společném `npm run qa:p5:ci` na čtyřech P5 výkonových limitech:

- `distBytes`: 928899 > 900000
- `entryCriticalBytes`: 578013 > 550000
- `precacheBytes`: 822081 > 800000
- `largestFileBytes`: 280926 > 270000

Funkční, bezpečnostní a platformní kontroly před tímto bodem procházely.

## Oprava
- Přímý tisk/PDF export byl přesunut z hlavního `app.js` do `src/lazy/print-exports.js`.
- Modul se načítá až při použití exportu a je současně zahrnut v offline cache service workeru.
- PWA ikony 180/192/512 byly obrazově optimalizovány; kanonické školní logo zůstává beze změny a platformní build jej nadále vynucuje.
- UX regrese byly upraveny tak, aby kontrolovaly i lazy PDF modul a jeho offline dostupnost.

## Výsledek
Po opravě:

- `distBytes`: 815209 <= 900000
- `entryCriticalBytes`: 547124 <= 550000
- `precacheBytes`: 724836 <= 800000
- `largestFileBytes`: 266511 <= 270000
- P5 quality: 43/43 PASS
- UX regrese: 21/21 PASS
- `npm test`: PASS
- school-server profil: úspěšně sestaven
