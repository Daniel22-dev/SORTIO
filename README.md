# SORTIO – Výukový panel

**Aktuální verze:** 1.1.20  
**Platforma:** GHRAB Platform 1.1.2

SORTIO je local-first aplikace pro organizaci třídy a řízení živé výuky. Spojuje import seznamu z IS, docházku, losování, chytré skupiny, role a zasedací pořádek s pracovní plochou navázanou na aktivní třídu pro časovače, hodiny, semafor, tabuli, kostky, skóre, obrázky, agendu, QR odkazy a hlasování.

## Hlavní zásady

- e-mailové adresy jsou pouze dočasným vstupem importu a neukládají se;
- jména, docházka, skupiny a další třídní data neopouštějí prohlížeč;
- knihovna obrázků používá Wikimedia Commons a do Wikimedia posílá pouze hledaný výraz / požadavek na vybraný obrázek, nikoli třídní data;
- QR hlasování je anonymní a po připojení školního serveru nevyžaduje jméno, e-mail ani ID studenta;
- projekční režim neukazuje interní profily, pravidla ani preference míst;
- diagnostický protokol neobsahuje jména studentů;
- zálohy se ověřují kontrolním součtem;
- při poškození primárního zápisu se použije poslední bezpečný stav;
- `ghrab-suite-session-v1` zajišťuje úklid vlastních aplikačních dat při ukončení společné relace AI Studia.

## SORTIO 1.1 obsahuje

### Organizace třídy
- správu tříd, archiv a aktualizaci seznamu z IS;
- losování bez opakování a vrácení posledního výběru;
- náhodné, vyvážené, homogenní a historicky promíchané skupiny;
- pravidla „spolu“, „od sebe“ a připnutí do skupiny;
- spravedlivou rotaci rolí a přidělování témat;
- zasedací pořádek s vlastním tvarem učebny 3 × 7 dvojlavic, pravidly „má sedět sám“ / „má sedět vepředu“, automatickým plněním od tabule dozadu a ručním drag & drop prohazováním;
- bezpečnou projekci, tiskové/PDF výstupy a historii zapojování.

### Výukový panel
- každá aktivní třída má vlastní uloženou pracovní plochu;
- widgety lze přesouvat, měnit velikost, zamykat, duplikovat a zvětšit do spotlightu;
- velikost karty a velikost jejího vnitřního obsahu se mění nezávisle;
- Timer s přímým nastavením minut a sekund pomocí +/−, velkým Startem a výběrem zvuků hudebních nástrojů / zvonku;
- kruhový Visual Timer nastavitelný tažením, stopky a analogové/digitální hodiny bez zbytečného alarmu;
- fyzický tříbarevný semafor bez textových popisků;
- kreslicí tabuli s perem, tvary, gumou, linkami a čtverečkovaným podkladem;
- vizuální D6/D12/D20, minci, náhodné číslo, písmena a vlastní textovou kostku s animacemi;
- týmové skóre včetně načtení aktuálních skupin SORTIO;
- textové instrukce, režim práce a agendu hodiny;
- rozšířenou knihovnu obrázků a pozadí z Wikimedia Commons bez uživatelského uploadu; pro pozadí upřednostňuje široké barevné scenérie a celé snímky zobrazuje bez ořezu s jemně rozostřenou výplní okrajů;
- lokální hlasování na plátně;
- frontend + API kontrakt pro anonymní QR hlasování studentů s živými výsledky po připojení školního serveru;
- QR odkazy připravené pro serverový generátor;
- fullscreen celé pracovní plochy vedle čisté bezpečné Projekce.

## QR hlasování

Statické nasazení na GitHub Pages nemá sdílený serverový stav mezi telefony studentů a učitelskou projekcí. Proto SORTIO 1.1 obsahuje kompletní frontend hlasování, veřejnou mobilní stránku `/poll/` a serverový kontrakt v `docs/SORTIO-LIVE-POLL-API.md`. Jakmile školní server implementuje uvedené endpointy, stejné UI automaticky používá QR kód a živě načítá výsledky.

## Vývoj a QA

```bash
npm ci
npm test
npm run test:internal
npm run build
npm run qa:release
```

GitHub Actions automaticky instalují Chromium, spouštějí P5/GARP release bránu, vytvářejí přesnou release identity a na GitHub Pages nasazují kanonický veřejný artefakt `dist-deployment/`.

## Nasazení

Produkční změny se připravují ve větvi `candidate`. Po GREEN P5 vytvoří Safe Promotion PR do chráněného `main`; required checks musí projít a teprve poté se změna automaticky sloučí. Produkční deploy vzniká pouze z ověřeného `main`, po nasazení se ověří live release identity a až následně se odešle `app-updated` do AI Studia.

`main` je chráněný rulesetem a přímý vývojový push do produkční cesty se nepoužívá.

**AI Studio není součástí tohoto repozitáře.** SORTIO 1.1.20 používá GHRAB Platform 1.1.2 a je zapojeno do ověřovaného auto-patch řetězce AI Studia.
