# SORTIO 1.1.17

Datum: 13. 9. 2026

## Účel vydání
Úzké opravné kolo po nezávislé GARP 2.5.1 Prompt E kontrole verze 1.1.16.

## Opravené nálezy
- N-05: GitHub Pages workflow před cross-profile staging regresí vytváří i `dist-school-server`, takže regresní brána již nepadá na chybějícím school stagingu.
- N-06: obnoven a aktualizován kompletní SHIELD assurance balík včetně threat modelu, exception registru, incident runbooku, scan/supply-chain souhrnů, kontrolních matic a přenášeného registru dluhů.
- N-07: přidána explicitní service-worker security-freeze kontrola nad `dist-deployment`, tedy přímo nad veřejně publikovaným artefaktem.

## Beze změny
- C-01 / service-worker network-only/no-store ochrana z 1.1.15 zůstává logicky beze změny.
- Funkce SORTIO, datový model a učitelský workflow se nemění.
- AI transport není přidán.
- SHIELD-LIVE a reálná studentská data nejsou tímto PREP releasem automaticky povolena.

## Otevřený hardening
- N-04: validace originu `studioBaseUrl` / `guardUrl` / `apiBaseUrl` zůstává záměrně oddělena pro další úzké hardening kolo.
