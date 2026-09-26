# GARP 2.7 migration assessment — SORTIO 1.1.21

## Vstup
- SORTIO 1.1.20 source archive SHA-256: `ea07fe6db27e43acfc3433dc10a48ab0b273fa6dc1061b50607b027b9b10ea86`
- GARP 2.7 consolidated r2/G-02 archive SHA-256: `0c278aefa0581b3ba13dd5725da9d3fc624976c255602ec16b054fc81da6f7c8`

## A-01 až A-07
- **A-01 ACCEPT** — používá se opravený r2 assurance kontrakt; aplikační gate nepřekládá chybějící runtime evidence na PASS.
- **A-02 ACCEPT** — GARP 2.7 auto-patch kontrakt vyžaduje důvěryhodnou release identity; SORTIO navíc zachovává existující fail-closed Safe Promotion řetězec.
- **A-03 ACCEPT/PARTIAL** — lokální/CI PASS je vázán na konkrétní testy a digests; skutečný school-server runtime zůstává NOT_TESTED.
- **A-04 ACCEPT** — aktivní validátory jsou výhradně z konsolidovaného r2/G-02 `MASTER/`; původní historické 2.5.1 validátory zůstávají jen regresní baseline.
- **A-05 ACCEPT** — jediná aktivní autorita nové vrstvy je GARP 2.7; žádný nový modul nevyžaduje GARP 2.6.
- **A-06 ACCEPT/PARTIAL** — serverově podmíněné kontroly jsou explicitně DEFERRED/NOT_TESTED; lokální CI kontroluje pouze bezpečné syntetické/mutační scénáře.
- **A-07 ACCEPT** — package/contract selftest je označen jako kontraktní test a není používán jako důkaz LIVE bezpečnosti aplikace.

## Rozhodnutí migrace
Stávající GARP 2.5.1/N5, GHRAB Platform 1.1.2, Safe Promotion, release-integrity a aplikační regrese byly zachovány. Nový kód je omezen na GARP 2.7 policy/admission/integrity adaptery, mutation testy a CI brány. Žádná nová školní serverová infrastruktura nebyla vytvořena.
