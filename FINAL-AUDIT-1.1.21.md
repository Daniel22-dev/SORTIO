# SORTIO 1.1.21 — závěrečný audit GARP 2.7

Datum: 2026-09-25

## Výsledek

**FOUNDATION_PASS_LIVE_NOT_TESTED**

SORTIO bylo migrováno na GARP 2.7 r2/G-02 jako aktivní aplikační bezpečnostní autoritu. GARP 2.5.1/N5 zůstává zachován jako regresní baseline. School-server fáze je podle rozhodnutí vlastníka stále odložena; žádná serverová live kontrola proto není označena jako PASS bez skutečné runtime evidence.

## Provedené změny

- verze 1.1.20 -> 1.1.21;
- vendorizovaný konsolidovaný GARP 2.7 r2/G-02 referenční balík (64 souborů);
- `security/garp27/`: policy, capability inventory, migration profile, architecture policy, live status a kryptografický trust anchor;
- `scripts/garp27/`: contract gate, architecture-integrity, policy mutation, application mutation, auto-patch contract a foundation gate;
- release identity a AI Studio `app-updated` dispatch používají `GARP-2.7`;
- school-server profil je fail-closed: `liveServerValidationRequired=true`, přitom `schoolServerConnected=false`;
- workflow P5/deploy pinují SHA-256 trust anchoru a spouštějí kumulativní GARP 2.7 bránu;
- zachovány všechny existující GARP 2.5.1/N5 kontroly;
- aktualizovány changelog, manuál, README, architektura, release acceptance a SBOM 1.1.21;
- opravena existující CLI definice deployment SBOM příkazů (`--deploy` používal chybný poziční argument).

## Bezpečnostní hranice SORTIO

- generativní AI: **není používána**;
- provider/API klíče: **nejsou povoleny**;
- externí egress: explicitně Wikimedia Commons / upload.wikimedia.org;
- classroom data: local-first;
- backup import: JSON, max. 5 MiB, kontrola schématu/checksumu/ID + sanitizace;
- budoucí live poll: same-origin school API, serverová část dosud DEFERRED/NOT_TESTED.

## Ověření

- `npm test`: **PASS**;
- GARP 2.7 foundation gate: **9/9 PASS**;
- GARP 2.7 mutation suite: **13/13 PASS** (pozitivní kontrola + 12 odmítnutých oslabení);
- GARP 2.7 policy admission mutations: **6/6 PASS**;
- GARP 2.7 auto-patch contract: **5/5 PASS**;
- GHRAB Platform conformance: **108/108 PASS**;
- UX current regressions: **46/46 PASS**;
- Lesson Board regressions: **47/47 PASS**;
- doménové testy a package 3/4/5 runtime testy: **PASS**;
- XSS sink regression audit: **PASS**;
- AI Studio dispatch contract: **PASS**;
- error reporter regression: **51 PASS / 0 FAIL** (browserová část environment-blocked stejnou spravovanou Chromium URLBlocklist politikou);
- legacy GARP 2.5.1/N5 static regression gate: **PASS**.

## P5 runtime poznámka

Samostatný `qa:p5` doběhl přes browser konformanci, ale lokální P5 runtime harness nemohl navigovat na svůj auditní server `127.0.0.1`: Chromium v tomto prostředí vrátilo `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Jde o omezení běhového prostředí, nikoli o runtime chybu SORTIO. Standardní browser konformance ve stejném auditu prošla. Tato položka proto není vydávána za aplikační FAIL ani za otestovaný live server stav.

## Trust anchor

- `security/garp27/trust-anchor.json` SHA-256: `e0b379233bdfa7beaaeab1bd902403d58cc2191e01802812c25be081b02277a2`
- GARP 2.7 vendor tree SHA-256: `2c653aa771c16ce1b610492bf5bf9d57c37af4987c85109de6cbb7cf8aa9a2fb`
- vendor file count: `64`

## Závěr

Zdrojový balík SORTIO 1.1.21 je připraven jako GARP 2.7 foundation-passing kandidát. Live school-server tvrzení zůstávají správně `NOT_TESTED` do okamžiku skutečného serverového nasazení a získání runtime evidence.
