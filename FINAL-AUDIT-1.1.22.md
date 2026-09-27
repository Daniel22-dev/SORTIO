# SORTIO 1.1.22 — závěrečný audit sjednocení „O aplikaci“

Datum: 27. 9. 2026

## Rozsah změny

Cílem verze 1.1.22 bylo sjednotit existující sekci **O aplikaci** se standardem používaným v ostatních aplikacích ekosystému AI Studio GHRAB bez změny funkčního chování SORTIO.

## Provedené změny

- sjednocen nadpis a úvod karty na model **Identita a projekt**;
- zachována identita SORTIO a produktový popis;
- zachován blok **Autor a vývojový garant — Daniel Baláž**;
- zachován blok **Školní projekt — Gymnázium, Ostrava-Hrabůvka**;
- původní samostatná hlavní karta **Ochrana dat** byla nahrazena standardním blokem **Přístup a určení**;
- technický stav byl sjednocen do formátu `v1.1.22 · PWA`;
- přidán standardní blok **Provozní zásady** se dvěma stručnými zásadami relevantními pro SORTIO;
- changelog byl převeden do sbaleného **Katalogu změn** přímo uvnitř části O aplikaci;
- aplikace i repozitář zobrazují právě posledních 10 vydaných aktualizací;
- doplněn changelog a release notes pro 1.1.22;
- verze byla konzistentně zvýšena z 1.1.21 na 1.1.22 v runtime, manifestu, PWA cache, QA a security metadatech;
- přegenerovány CycloneDX SBOM snapshoty pro 1.1.22;
- po změně appVersion byly přepočteny aplikační GARP 2.7 policy/inventory/architecture digesty v trust anchoru.

## Co se nezměnilo

- správa tříd a import;
- losování, skupiny, role a zasedací pořádek;
- Výukový panel a projekce;
- datový model a local-first ukládání;
- Wikimedia integrace a hlasování;
- GHRAB Platform 1.1.2;
- bezpečnostní autorita GARP 2.7 r2/G-02 a regresní baseline GARP 2.5.1/N5;
- serverově závislý stav zůstává `DEFERRED/NOT_TESTED`.

## Ověření

- `npm test` — PASS;
- UX regrese — **46/46 PASS**;
- GARP 2.7 static gate — PASS;
- error reporter kontrola — **51 PASS / 0 FAIL**;
- build a platform conformance — PASS;
- SBOM check/verify — PASS;
- GARP 2.5.1 selftest — **69/69 PASS**;
- source scan — PASS.

Prohlížečová část testu reportéru nebyla v tomto pracovním prostředí spuštěna, protože spravovaná Chromium politika blokuje všechny testovací URL. Statická a zdrojová kontrola reportéru skončila 51 PASS / 0 FAIL.

## Závěr

SORTIO 1.1.22 má sekci **O aplikaci** sjednocenou s aktuálním standardem ostatních aplikací AI Studia. Funkční rozsah aplikace nebyl změněn a dostupné regresní, bezpečnostní a build kontroly jsou zelené.
