# Changelog

## 1.1.9 — 2026-09-08

- Vlastní tvar učebny nyní kreslí **dvojlavice**: jedno označené políčko = jedna lavice pro 2 studenty; kapacita se automaticky počítá jako počet lavic × 2.
- Nepravidelný tvar učebny se normalizuje a jako celek automaticky vystřeďuje v hlavním zasedacím plánu, bezpečné projekci i exportu PDF A4 naležato.
- Vyčištění Výukového panelu používá vlastní potvrzovací modal; ve fullscreen režimu potvrzení ani samotné vyčištění neopouští celou obrazovku.
- Zesíleno vykreslení tlačítka „Promítnout“ a barevných miniatur pozadí, aby je nepřebíjely starší/theme styly AI Studia.
- Knihovna pozadí nově upřednostňuje široké barevné scenérie a architekturu a potlačuje portréty, známky, mince, televizory/obrazovky, dokumenty, loga a další nevhodné encyklopedické motivy.
- Obrázkové pozadí se zobrazuje **celé bez ořezu** (`contain`); případný volný prostor vyplní rozostřená kopie stejného snímku, takže plocha zůstává vizuálně plná.
- Wikimedia knihovna byla přesunuta do lazy modulu, aby nové filtrování a řazení nezvýšilo kritický vstupní balík ani PWA precache nad GHRAB performance budget.

## 1.1.8 — 2026-09-08

- Nový zasedací plán začíná s úplně prázdnou mřížkou bez automaticky předkreslených míst.
- Rychlé tvary jsou nyní skutečně volitelné: u prázdného plánu se zobrazuje neutrální volba „Vyberte předlohu…“.
- Počet míst u nového plánu začíná na 0; existující uložené zasedací plány zůstávají beze změny.

## 1.1.7 — 2026-09-08

- Losování a projekce bez technických textů o cyklu.
- „Místa“ přejmenována na „Zasedací plán“ a předvolby jsou pojmenované podle skutečného uspořádání učebny.
- Přidán Word-like mřížkový editor skutečného tvaru učebny s nepravidelnými řadami a automatickým počtem míst.
- Zasedací plán nabízí projekci a přímý PDF export A4 naležato; samostatné tlačítko Tisk bylo odstraněno.
- Opraven vzhled tlačítka Promítnout, miniatury pozadí a vykreslení Wikimedia pozadí.
- Vyčištění Výukového panelu ve fullscreen režimu už neukončuje fullscreen.
- Větší a lépe rozmístěné puntíky D6.
- Čerstvé lokální úložiště bez bezpečné kopie už není chybně označeno jako „Vyžaduje pozornost“.

## 1.1.6 — 2026-09-07

- Volba aktivní třídy přímo na Přehledu a oprava průběžného hledání studentů.
- Větší vícenásobné losování, srozumitelnější plán rozdělení skupin a přímé „Znovu promíchat“.
- Ruční přiřazení konkrétního studenta ke konkrétní roli a ruční volba tématu u skupiny.
- Zasedací pořádek: vysvětlení směru řad, živý výpočet kapacity, větší vstupy, drag & drop a přímá projekce.
- Zasedací pořádek: tisk/PDF připravený na A4 naležato s povinným logem školy.
- Projekce: odstraněn pozůstatek „Původní třídní nástroje“ a zvětšena témata, role a skupiny.
- Výukový panel: fullscreen přetrvává při změnách, viditelné barvy pozadí, vyčištění panelu, opravy velikostí widgetů a odstranění vnitřních scrollbarů.
- Timer/Visual timer: kompaktní Spustit/Pauza, upravené zvukové popisky; Agenda se edituje přímo v kartě.

## 1.1.5 — 2026-09-06

- Opraven suite-session negative-control harness: verze 1.1.4 vypínala jen `session.onEnd()`, ale bezpečnostní storage/pageshow/focus guardy stále legitimně provedly cleanup a způsobily falešný CI FAIL.
- Odhoditelná kopie nyní vypíná přímo `performSuiteSessionCleanup()`, takže negative control prokazatelně zachová syntetický canary a produkční safety assertion očekávaně selže.
- Produkční cleanup a Platform 1.1.2 runtime se nemění.

## 1.1.4 — 2026-09-06

- Doplněn povinný suite-session negative control pro Platform 1.1.2: oslabená odhoditelná kopie musí FAIL a čistý produkční kód následně PASS.
- Přidána hashová evidence oslabené kopie; produkční cleanup logika se nemění.

## 1.1.3 — 2026-09-05
- Přidáno viditelné tlačítko **Manuál** do horní lišty aplikace.
- Tlačítko otevírá existující interaktivní manuál v nové kartě, takže učitel nepřijde o rozpracovaný stav SORTIO.
- Nápověda horní lišty nově popisuje i vstup do manuálu.
- Přidána regresní kontrola, že odkaz na manuál je dostupný přímo z hlavního rozhraní.

## 1.1.2 — Workflow a UX Výukového panelu (2026-09-05)

- jedna pracovní plocha navázaná na aktivní třídu místo uživatelských scén;
- fullscreen pracovní plochy a nezávislé měřítko obsahu widgetů;
- přepracovaný Timer a kruhový Visual Timer; nové instrumentální zvuky;
- hodiny bez alarmu, semafor bez popisků, vizuální animované kostky a mince;
- event countdown odstraněn z nabídky;
- rozšířená Wikimedia knihovna a opravené obrazové pozadí;
- automatická diakritika běžných českých křestních jmen při importu z IS;
- opravené zobrazení školního loga.

## 1.1.0 — Výukový panel (2026-09-05)

### CI hotfix 2026-09-05 — email-not-stored regression

- Obnovena přesná bezpečnostní formulace „Importované e-mailové adresy se po vytvoření náhledu neukládají.“ v informační kartě aplikace.
- Funkční chování se nemění: importované e-mailové adresy se nadále nepersistují; oprava znovu splňuje interní regresní kontrolu `email-not-stored`.
- Po opravě `test:internal` prošel 35/35 a celý `npm test` zůstal PASS.

- SORTIO přejmenováno z „Organizátor třídy“ na „Výukový panel“ a rozšířeno o scénovou pracovní plochu pro živou výuku.
- Přidán obecný widget engine: přesun, resize, lock, duplicate, delete a spotlight.
- Přidány Timer 2.0, Visual timer, Stopky, Hodiny, Semafor, Tabule, Kostky 2.0, Skóre 2.0, Text, Režim práce, Obrázek, Event countdown, Agenda, Hlasování a QR odkaz.
- Přidána vestavěná obrazová knihovna nad Wikimedia Commons bez uživatelského uploadu, včetně zdroje a licence.
- Přidán anonymní live-poll frontend, veřejná mobilní stránka a kontrakt školního serveru pro QR hlasování s živými výsledky.
- Měřič hluku záměrně nebyl přidán; mikrofon zůstává zakázaný.
- Nový panel funguje bez vybrané třídy; třídní nástroje zůstávají dostupné po výběru třídy.
- Zachována GHRAB Platform 1.1.2, suite-session cleanup a bezpečnostní/regresní brány.

## 1.0.17 — GHRAB Platform 1.1.2 / suite-session kandidát (2026-09-04)

- Převzata přesná referenční GHRAB Platform 1.1.2 z AI Studia 0.21.40.
- Přidán `ghrab-suite-session-v1` lifecycle: pre-hydration replay, live cleanup, write guard, idempotence a fail-closed acknowledgement.
- PC-01 zpřesnil vlastnictví storage; migration full backup se maže jako potenciálně osobní obsah, settings/lifecycle tombstones zůstávají.
- Opraven skutečný cross-tab storage klíč na kanonický `ghrab.sortio.data.v5`.
- Sledovaná tisková okna s obsahem se při ukončení suite relace zavřou.
- Přidány automatizované suite-session testy a povinný negative control pro release wave.
- Kandidát není produkční release; E-01, centrální F-02 a same-origin F-03 zůstávají ekosystémovou podmínkou/follow-upem.

## 1.0.16 — uzavření LOW nálezů po druhé GARP 2.3 kontrole (2026-09-03)

### CI hotfix 2026-09-03 — hostile-render Chromium target race

- Opraven race condition v `scripts/garp-hostile-render.mjs`: test nyní čeká na skutečný CDP `page` target místo jednorázového čtení `/json`.
- Přidána regrese, která hlídá, že readiness čekání zůstane zapojené.
- Produkční `src/` se nemění; aplikační verze zůstává 1.0.16.

- Opravena kolize interních ID na persistentní `loadData()` cestě bez sloučení identit.
- Zachováno fail-closed odmítnutí kolizních importovaných záloh.
- Behaviorální hostile-render a canary testy zapojeny do `npm test` i `qa:p5:ci`.
- Přidány regrese pro N-08 a PC-01 persistentní vstupní cestu.
- Release Integrity po změně po druhém Claude kole zůstává AMBER do nového výslovného ověřovacího cyklu.

## 1.0.15 — GARP 2.3 opravný bezpečnostní kandidát (2026-09-03)

- Opraven stored XSS vektor z importovaných persistentních identifikátorů (N-02 / RT-07 / RT-08 / SIM-08).
- Opraven multi-tab konflikt při startu nad prázdným úložištěm a přidána cross-tab synchronizace (N-01 / RT-15 / SIM-04).
- Statická CSP je napojena na build pro všechny chráněné HTML vstupy a přidán fail-closed cross-origin frame guard (N-03 / RT-13).
- Odstraněn neověřovaný `deployment.school-server-p0.json`; všechny distribuované deployment profily jsou kryty bezpečnostní regresí (N-04).
- Reporterové PASS položky používají skutečné podmínky a browserové QA sdílí detekci Chromia (N-05/N-06).
- Import fail-closed odmítá duplicitní interní identifikátory nalezené při volném adversariálním hledání.
- Známý hardeningový dluh `unsafe-inline` zůstává explicitně evidován.

## 1.0.14 — GARP bezpečnostní kandidát (2026-08-27)

- Deployment fallback je fail-closed (`configuration-unavailable`, `authMode: disabled`) místo provozního GitHub fallbacku.
- Chráněný kód aplikace, manuálu a testovacího centra se na veřejné cestě aktivuje až po zachycení oprávnění pro SORTIO z centrální brány.
- `sharedAccessVersion` je synchronizována s aktuálním podepsaným access bundle AI Studia; produkce výslovně drží 24 h LKG a 30 dní stáří bundle.
- Deployment konfigurace se neukládají do běžné PWA precache.
- School-server profil zůstává `server-session` a zakazuje lokální provider klíče.
- GitHub Actions jsou připnuté na konkrétní commit SHA.
- Přidán `test:garp-security`, který výše uvedené vlastnosti hlídá proti regresi.
- CSP stále obsahuje `unsafe-inline` kvůli současné single-file/inline architektuře; jde o známý hardeningový dluh, ne nově zavedenou regresi.

## 1.0.12 — sjednocení reportéru (2026-08-13)

- Reportér používá dvoukrokové vytvoření a skutečné stažení diagnostického ZIPu; Gmail je dostupný až po kliknutí na stažení.
- Rozhraní i e-mail vyžadují ruční přiložení ZIPu a pomocné video je bezpečně skryté uvnitř reportéru i při scrollování.
- Regresní sada fyzicky ověřuje stažený ZIP, jeho snímky a diagnostiku, jednu instanci reportéru, motivy, mobilní zobrazení a klávesnici.
- Funkce organizace třídy ani lokální data nebyly změněny; PWA cache je `ghrab-sortio-v1.0.12`.

## 1.0.11 — P5 (2026-08-05)
### CI hotfix 2026-08-08
- Visual QA používá pouze v testovacím serveru odemčenou podobu chráněných HTML stránek, aby přímé testování `manual/` a `tests/` nepadalo na nedostupném Studio bootstrapu.



## 1.0.11 — P5 R2

- Opraven reflow projekčního dialogu a manuálu na 320 px.
- P5 R2 runtime audit se skripty a odemčeným UI.


- Předprodukční akceptace bez povinného školního serveru.
- Nulové otevřené automatické a11y nálezy jsou podmínkou P5 brány.
- Přidán aktualizovaný release-acceptance kontrakt a odložený GitHub upload.

# Changelog

## 1.1.8 — 2026-09-08

- Nový zasedací plán začíná s úplně prázdnou mřížkou bez automaticky předkreslených míst.
- Rychlé tvary jsou nyní skutečně volitelné: u prázdného plánu se zobrazuje neutrální volba „Vyberte předlohu…“.
- Počet míst u nového plánu začíná na 0; existující uložené zasedací plány zůstávají beze změny.

## 1.0.9 — P4 FINAL (2026-08-04)

- Finální certifikace, čisté buildy, přístupnost, výkon, bezpečnost a release evidence.
- Přidána povinná `qa:p4:ci` brána.

## 1.0.8 - 2026-08-04 (P3)

- Platforma 1.1.0, pristupnost, performance budgety a modularizace P3.

## 1.0.7 — P2: sjednocení platformy GHRAB (2026-08-04)

- jeden kanonický školní logotyp a jednotná autorská patička;
- GHRAB Platform 1.0.0: motiv, storage namespace s vratnou migrací, Studio Bridge 2.0 a artifact envelope v1;
- jednotný název PWA cache `ghrab-sortio-v1.0.7` a řízená aktualizace;
- platformní konformitní test je součástí buildu a CI.


## 1.0.6 — P1 (2026-08-04)

- Produkční bezpečnost, serverový profil, datové manifesty a jednotná observability vrstva.
- AI Core: not-applicable; společná serverová platforma bez AI transportu.

# Changelog

## 1.1.8 — 2026-09-08

- Nový zasedací plán začíná s úplně prázdnou mřížkou bez automaticky předkreslených míst.
- Rychlé tvary jsou nyní skutečně volitelné: u prázdného plánu se zobrazuje neutrální volba „Vyberte předlohu…“.
- Počet míst u nového plánu začíná na 0; existující uložené zasedací plány zůstávají beze změny.

## 1.0.5 — 2026-08-04

- Etapa P0: odstraněn nebezpečný cache-first režim bezpečnostních zdrojů a HTML fallback pro JS/JSON, doplněno stabilní PWA id a server-ready deployment kontrakt.
## 1.0.4 — 2026-08-03

- zavedena jediná lokální instance společného reportéru AI Studia;
- centrální reportér app-guardu je vypnut přes `errorReporter: false`;
- motiv se živě odvozuje z `html[data-theme]` a plovoucí prvky respektují toastovou oblast;
- PWA cache, manifest, release workflow a centrální návod byly aktualizovány.

Starší podrobnosti jsou v `RELEASE-NOTES-*.md`.
