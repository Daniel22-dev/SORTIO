# SORTIO changelog

V aplikaci i v tomto souboru se drží pouze posledních 10 vydaných aktualizací. Starší technická historie zůstává v samostatných `RELEASE-NOTES-*.md`.

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

## 1.1.13 — 2026-09-09
- Opraveny rozbalovací seznamy pravidel „Má sedět sám“ a „Má sedět vepředu“: po změně checkboxu se zasedací pohled zbytečně nepřerenderuje a seznam zůstává otevřený pro vícenásobný výběr.
- Přidána regresní kontrola, která hlídá persistenci preference bez překreslení zasedacího pohledu.
- Changelog v aplikaci zůstává omezen na posledních 10 verzí; opravena také duplicita označení 1.1.12/1.1.11 v předchozím zobrazení.

## 1.1.12 — 2026-09-08
- Odstraněna celá funkce „Kluk + holka“ včetně UI, párovací logiky a ukládaných párovacích údajů.
- Zasedací pořádek zůstává založený na pravidlech „Má sedět sám“ a „Má sedět vepředu“; případné dvojice učitel doladí ručním drag & drop prohozením.
- Starší zálohy s dnes již nepoužívanými párovacími poli zůstávají načitatelné; při sanitizaci se tato pole zahodí.

## 1.1.11 — 2026-09-08
- Zjednodušené workflow zasedacího pořádku: pravidla „Má sedět sám“ a „Má sedět vepředu“ jsou rozbalovací vícenásobné seznamy.
- Velký plán už není založený na rozbalovacích seznamech v každém místě; hlavní ruční úprava je drag & drop mezi místy, včetně přímého prohození dvou studentů.
- Automatické rozsazení postupuje od tabule dozadu, takže běžná volná místa zůstávají v zadní části učebny. Výjimkou je volné druhé místo u studenta, který má sedět sám, a ručně uzamčené pozice.
- Preference „Kluk + holka“ zůstává volitelná; párovací kategorie se nastavují výslovně v rozbalené sekci a nejsou odhadovány z jména.
- Changelog v aplikaci i repozitáři je omezen na posledních 10 aktualizací.

## 1.1.10 — 2026-09-08
- Zasedací editor 3 × 7 dvojlavic, samostatné sezení, zvýraznění volných míst a volitelná preference kluk + holka.
- Rozšířená knihovna pozadí s automatickým načtením více výsledků.
- Zelený provozní stav a procentuální průběh produkčních kontrol.
- CI hotfix: interní testy správně kontrolují i lazy `production-tools.js`.
