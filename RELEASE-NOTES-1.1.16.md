# SORTIO 1.1.16

Datum: 13. 9. 2026

## Účel vydání
Úzké opravné kolo po nezávislé GARP 2.5.1 Prompt E kontrole verze 1.1.15.

## Opravené nálezy
- N-01: production leak scanner již nekontroluje QA build s `tests/`, ale skutečný deterministický deployment staging.
- N-02: interní testovací centrum se do produkčního veřejného ani school-server deploymentu nepublikuje a produkční UI na něj neodkazuje.
- N-03: evidence reprodukovatelnosti rozlišuje QA build a finální deployment payload a obsahuje jejich explicitní srovnání.

## Beze změny
- Service-worker security-critical network-only/no-store oprava z 1.1.15 zůstává zachována.
- Datové schéma a učitelské workflow se nemění.
- AI transport není přidán.
- SHIELD-LIVE a reálná studentská data nejsou tímto PREP releasem automaticky povolena.

## Odložené hardening položky
- N-04: validace originu `studioBaseUrl` / `guardUrl` / `apiBaseUrl` zůstává oddělená pro další samostatné kolo, aby opravný release zůstal úzký.
