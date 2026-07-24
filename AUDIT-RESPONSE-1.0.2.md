# SORTIO 1.0.2 – vyhodnocení auditu a provedené opravy

**Datum:** 24. 7. 2026  
**Výchozí balík:** SORTIO 1.0.1  
**Výsledný balík:** SORTIO 1.0.2

## 1. Shrnutí

Audit byl porovnán přímo s produkčními moduly v dodaném ZIPu. Většina kritických a závažných nálezů byla správná. Některé body však vycházely ze staršího stavu projektu nebo navrhovaly řešení, které by oslabilo bezpečnost.

Opravy byly provedeny po etapách:

1. funkční jádro – docházka, skupiny a přelosování;
2. odolnost dat – bezpečný stav, zaplněné úložiště a zálohy;
3. kód a build – duplicity funkcí a kontrola buildu;
4. testy a CI – testování skutečných produkčních modulů;
5. UX, import, přístupnost a menší nálezy;
6. PWA – instalace a pravdivá dokumentace bezpečnostních omezení.

## 2. Blokující a závažné nálezy

| Nález | Výsledek ověření | Stav v 1.0.2 |
|---|---|---|
| **S1 – docházka smaže skupiny, sezení a losovací balíček** | potvrzeno | opraveno; docházka pouze synchronizuje losovací balíček, vytvořené skupiny a sezení zůstávají zachovány |
| **S2 – přelosování s nepřítomným členem spadne** | potvrzeno | opraveno; neznámá/nepřítomná ID se bezpečně ignorují a kapacity se počítají z aktuální docházky |
| **S3 – last-good je totožný s primárním stavem** | potvrzeno | opraveno; `last-good` nyní obsahuje předchozí ověřený primární stav |
| **S4 – plná kvóta znemožní vymazání dat** | potvrzeno | opraveno; čtení a mazání fungují i při selhání zápisu, blokované úložiště se rozpozná samostatně |
| **S5 – CI nespouští QA** | v dodaném ZIPu již neplatilo | workflow už mělo automatické triggery, Chromium i `qa:release`; doplněno pouze ukládání QA výsledků jako artefaktu a kontrola verze 1.0.2 |
| **S6 – plný offline start nefunguje přes přístupovou bránu** | potvrzeno | dokumentace opravena; PWA lze instalovat a cachuje lokální prostředky, ale nové spuštění vyžaduje online ověření |
| **S7 – testy netestují produkční kód** | potvrzeno | doménové testy přepsány na načítání skutečných modulů přes `vm`; strukturální kontrola oddělena od testů |
| **S8 – duplicitní deklarace funkcí** | potvrzeno | duplicity odstraněny; build nyní další duplicitní deklaraci odmítne |
| **S9 – starší záloha může být odmítnuta kvůli sanitizaci** | potvrzeno | checksum se ověřuje nad původními daty souboru; při neshodě je možné vědomé načtení |
| **S10 – překreslení ničí rozepsaný stav** | potvrzeno | krátkodobé řešení z auditu realizováno: stav ovládacích prvků, kurzor, fokus, režim losování a mezičasy jsou obnovovány |

### Bezpečnostní rozhodnutí u S6

Audit doporučil sedmidenní lokální povolenku uloženou v `localStorage`. Taková povolenka bez kryptografického podpisu by byla uživatelsky upravitelná a umožnila by obejít přístupovou bránu. Proto nebyla implementována.

Pro skutečný bezpečný offline start je potřeba, aby centrální `app-guard.js` vydával časově omezený, kryptograficky podepsaný token, který aplikace pouze ověří. Do té doby zůstává start bezpečně **fail-closed**.

## 3. Další provedené opravy

- nepřítomní studenti jsou v zachovaných skupinách a rolích viditelně označeni;
- přidáno tlačítko **Přepočítat podle docházky**;
- student, který se vrátí do hodiny, se doplní do běžícího losovacího cyklu jen tehdy, pokud už nebyl vylosován;
- legitimní jmenovci mohou být po potvrzení přidáni i přejmenováni;
- import umí `jméno.příjmení` i `příjmení.jméno` a odstraňuje koncové číselné suffixy účtů;
- zkratky modulů změněny na `Alt + Shift + 1–9`;
- přidáno instalační tlačítko PWA v Nastavení;
- odstraněny trvale běžící intervaly mimo aktivní časovač/projekci;
- render skóre už nemění data bez uložení;
- `escapeHtml` ošetřuje také apostrof;
- tisk skupin bez skupin zobrazí srozumitelnou chybu;
- rozsazování používá mapu ID → student místo opakovaného lineárního hledání;
- náhodné rozhodování skupin a sezení používá společný kryptografický generátor;
- sanitizace propouští jen povolené top-level klíče;
- limity historií jsou sjednoceny v jedné konstantě;
- dnešní losování se počítá podle místního data, nikoli UTC;
- symbolová tlačítka dostala smysluplné názvy pro čtečky;
- dialogy mají základní ARIA vazby a aktivní navigace `aria-current`;
- osobní e-mail odstraněn z veřejného QA manifestu;
- dokumentace, manuál, manifest, interní testovací centrum a `dist/` aktualizovány na 1.0.2.

## 4. Záměrně odložené změny

Tyto body nejsou nutné k odstranění potvrzených produkčních chyb a představují samostatný architektonický zásah:

- **M19:** úplná konsolidace všech CSS breakpointů;
- **N1:** rozdělení chráněného inline monolitu na hashované soubory;
- **N2:** úplné cílené překreslování jednotlivých uzlů místo obnovy stavu po renderu;
- **N3:** plošné zavedení Prettieru a ESLintu do celého historického kódu;
- **N5–N8, N10:** session persistence časovače, víceúrovňové undo, Web Worker, CSV export a náhrada všech nativních dialogů;
- bezpečný offline přístup přes podepsaný token centrální brány.

Část návrhu **N9** byla realizována v rámci oprav přístupnosti.

## 5. Ověření

Úspěšně proběhlo:

- `npm test` – strukturální kontrola a produkční doménové/regresní testy;
- `npm run test:internal` – **35/35 PASS**;
- `npm run build` – sestavení verze 1.0.2;
- `npm run qa:technical` – **PASS**;
- `npm run qa:security` – **PASS**;
- `npm run qa:pwa` – **PASS**;
- `npm run qa:combinatorial` – **PASS**, 28/162 scénářů, pairwise 100 %;
- prohlížečové scénáře Package 4 a Package 5 v systémovém Chromiu – **PASS**;
- vlastní prohlížečová regrese docházky, skupin, sezení, losovacího balíčku a obráceného importu – **PASS**.

Plný lokální příkaz `npm run qa:release` nebylo možné v tomto pracovním prostředí dokončit, protože instalace balíčků Playwright a PNGJS z npm registry skončila chybou brány 503. Nejde o chybu projektu. Prohlížečové scénáře byly proto spuštěny dostupným systémovým Chromiem přes Python Playwright a prošly. GitHub Actions zůstává nastaveno tak, aby po nahrání spustilo kompletní `qa:release` nad registry.npmjs.org.

## 6. Doporučený postup nahrání

1. Nahrát obsah balíku do repozitáře SORTIO a zachovat skrytou složku `.github`.
2. Commitnout do větve `main` nebo `master`.
3. Otevřít GitHub Actions a zkontrolovat workflow **SORTIO QA and Deploy**.
4. Za správný výsledek považovat až zelený job **Test and build SORTIO** a následný **Publish SORTIO**.
5. Stáhnout artefakt `qa-results`, pokud bude potřeba archivovat důkaz o vydání.
