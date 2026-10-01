# SORTIO changelog

V aplikaci i v tomto souboru se drží pouze posledních 10 vydaných aktualizací. Starší technická historie zůstává dohledatelná v Git historii; v kořeni repozitáře se udržují jen aktuální release notes a aktuální závěrečný audit.

## 1.1.23 — 2026-10-01
- SORTIO se nově bezpečně napojuje na AI Studio **Moje skupiny** jako kanonický zdroj členství třídy; výběr skupiny používá consumer-safe metadata API a roster projekci pro `sortio`.
- Do SORTIO se z centrální vrstvy přenáší pouze `groupId`, revize, `memberId`, zobrazované jméno a stav člena; e-mailová pole jsou fail-closed odmítnuta.
- Synchronizace používá náhled změn, kontrolu revize a nedestruktivní archivaci/obnovu, přičemž docházka, historie losování, skupinová pravidla, role, zasedací pořádek, locky, engagement, skóre a Výukový panel zůstávají lokální doménou SORTIO.
- Ruční import z IS zůstává jako fallback a existující lokální třídu lze pouze explicitním potvrzením jednorázově migrovat do centrálních Moje skupiny.

## 1.1.22 — 2026-09-27
- Sekce **O aplikaci** byla sjednocena se standardem ostatních aplikací AI Studia: identita, autor a vývojový garant, školní projekt, přístup a určení a technický stav.
- Přidán blok **Provozní zásady** a dosavadní samostatná karta ochrany dat byla nahrazena společnou strukturou standardu.
- Posledních deset změn je nově uvnitř sbaleného **Katalogu změn**; samostatná historie mimo kartu nevzniká.
- Funkce organizace třídy, Výukového panelu, datový model ani bezpečnostní hranice se nemění.

## 1.1.21 — 2026-09-25
- Aktivní bezpečnostní autorita byla povýšena na GARP 2.7 r2/G-02; GARP 2.5.1/N5 zůstává zachován jako regresní baseline.
- Přidány jsou aplikační GARP 2.7 policy/inventory kontrakty, připnutý referenční balík, architecture-integrity kontrola a negativní mutation testy.
- Release identity i `app-updated` dispatch do AI Studia nyní deklarují `GARP-2.7`; školní serverový profil zůstává záměrně `DEFERRED/NOT_TESTED` a fail-closed.
- Funkce aplikace, datový model a local-first provoz se nemění.

## 1.1.20 — 2026-09-20
- Finální repository clean-up: odstraněn zastaralý ruční upload návod, kořenový 1.1.17 zdrojový ZIP a duplicitní legacy P3/P4 workflow entrypointy.
- Aktivní UX a SBOM tooling už není názvem/výchozí cestou svázán s konkrétní starší PATCH verzí.
- README, architektura a release-acceptance metadata byly sjednoceny s dnešním Safe Promotion a ověřovaným auto-patch řetězcem.
- Funkce aplikace ani datový model se nemění.

## 1.1.19 — 2026-09-20
- Opravena přesná GitHub Pages release identity: `.nojekyll` se už nezahrnuje do veřejně ověřovaného artifact digestu, protože jde o deployment marker spotřebovaný Pages a není veřejně dostupný přes HTTP.
- AI Studio tak může nezávisle ověřit všechny deklarované soubory i výsledný `artifactDigest` bez oslabení fail-closed kontroly.
- Funkce aplikace a datový model se nemění.

## 1.1.18 — 2026-09-19
- Safe Promotion používá chráněný `main`, produkční deploy navazuje na GREEN P5 a live release identity váže verzi na source commit, artifact digest, manifest, SBOM, provenance a security evidence.
- Po live ověření aplikace odesílá `app-updated` do AI Studia.
- Funkce aplikace a datový model se nemění.

## 1.1.17 — 2026-09-13
- Opravné GARP 2.5.1 SHIELD kolo po nezávislé kontrole 1.1.16.
- GitHub Pages workflow nyní před cross-profile regresí deterministicky staví i school-server staging, takže nasazení nezastaví chybějící `dist-school-server`.
- Veřejný `dist-deployment` má vlastní service-worker security-freeze kontrolu přímo nad artefaktem, který se publikuje.
- Obnoven kompletní SHIELD assurance balík, matice kontrol, registr výjimek a přenášený registr dluhů; N-04 zůstává záměrně otevřený hardening.

## 1.1.16 — 2026-09-13
- Opravný GARP 2.5.1 SHIELD-PREP release po nezávislé Prompt E kontrole.
- Přidán deterministický production staging: interní `tests/` zůstávají v QA buildu, ale nejsou součástí veřejného ani school-server deploymentu.
- Produkční UI a manuál již neodkazují na nepublikované testovací centrum.
- Leak scanner kontroluje skutečné deployment stagingy; evidence reprodukovatelnosti nově porovnává build i finální payload.
- N-04 (origin hardening autoritativní konfigurace) zůstává záměrně oddělen pro další kolo.

## 1.1.15 — 2026-09-13
- GARP 2.5.1 SHIELD-PREP: security-critical runtime resources jsou v service workeru network-only/no-store a nejsou precachovány.
- Doplněny release-integrity nástroje, CycloneDX SBOM, provenance, evidence manifest, supply-chain a negative-control kontroly.
- Funkční workflow SORTIO a datový model zůstávají beze změny.

## 1.1.14 — 2026-09-09
- Opravena volba barvy pera ve widgetu Tabule: změna barvy se ukládá okamžitě přes `input` i `change`, bez překreslení widgetu, takže následující tah používá skutečně vybranou barvu.
- Tlačítko „Smazat“ ve widgetu Tabule nyní rovnou vyčistí všechny tahy bez potvrzovacího dialogu. Potvrzení pro „Vyčistit panel“ zůstává zachované.
- Přidány regresní kontroly pro změnu barvy pera a okamžité mazání tabule.
