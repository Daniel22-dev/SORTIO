# SORTIO 1.0.17 — kandidát GHRAB Platform 1.1.2 ecosystem release wave

Datum: 2026-09-04

## Účel změny

SORTIO 1.0.17 migruje z GHRAB Platform 1.1.0 na přesnou referenční vrstvu GHRAB Platform 1.1.2 a přidává child-side podporu kontraktu `ghrab-suite-session-v1` pro bezpečné ukončení společné relace AI Studia na sdíleném zařízení.

## Hlavní změny

- vendorovaná Platforma je převzata přímo z referenčního AI Studia 0.21.40;
- `requiredRange` je `>=1.1.2 <2.0.0`, cache je `ghrab-sortio-v1.0.17`;
- před hydratací aplikačních dat se zpracuje pending suite-session replay;
- live suite end blokuje další content writery, provede lokální cleanup a teprve potom zapíše acknowledgement;
- acknowledgement je lokálně ověřen čtením `ghrab.sortio.suite-session-seen.v1`;
- oddělen je signal / observed / cleanup-completed / acknowledged stav;
- cleanup vychází z opraveného `data-manifest.json` a nemaže settings, migration-done ani lifecycle tombstones;
- migration full backup je klasifikován jako potenciálně osobní a při suite end se maže;
- opraven cross-tab listener z logického `sortio.data.v5` na skutečný kanonický storage klíč;
- tisková okna s aplikačním obsahem jsou sledována a při suite end zavřena;
- přidána suite-session regrese s open-child, delayed replay, multi-tab guard, history lifecycle a fail-closed scénářem.

## Release status

Toto není automaticky produkční release. Jde o kandidáta pro koordinovanou Platform 1.1.2 ecosystem release wave. Uzavření E-01 vyžaduje migraci a společné ověření všech relevantních child aplikací. F-02 má lokální child acknowledgement, ale centrální AI Studio 0.21.40 nečeká na agregované acknowledgement všech child aplikací. F-03 zůstává same-origin trust-boundary dluhem na úrovni ekosystému.
