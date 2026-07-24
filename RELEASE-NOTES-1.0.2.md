# SORTIO 1.0.2 – auditní opravný balík

Verze 1.0.2 reaguje na hloubkový audit produkční verze 1.0.1. Opravy byly ověřeny proti skutečnému zdrojovému kódu; některé body auditu už v dodaném ZIPu neplatily a nebyly znovu implementovány.

## Kritické opravy

- změna docházky už nemaže vytvořené skupiny, zasedací pořádek ani rozpracovaný cyklus losování;
- nepřítomní členové zůstávají ve starších skupinách viditelně označeni a skupiny lze přepočítat podle aktuální docházky;
- přelosování odemčených skupin bezpečně ignoruje nepřítomné členy uzamčených skupin;
- `last-good` nyní uchovává předchozí ověřený stav, nikoli kopii právě uložených dat;
- vymazání dat funguje i při zaplněné kvótě úložiště;
- kontrolní součet zálohy se ověřuje nad původním obsahem souboru.

## Testy a udržovatelnost

- doménové testy načítají produkční moduly namísto vlastních kopií algoritmů;
- doplněny regresní testy docházky, losovacího balíčku, přelosování, obnovy dat a plné kvóty;
- odstraněny duplicitní deklarace funkcí a build je nově automaticky odmítne;
- CI ukládá výsledky QA jako artefakt; stávající automatické spouštění a QA brána byly v dodaném ZIPu již správně nastaveny.

## UX, import a přístupnost

- rozepsané vstupy, režim losování, počet losovaných a mezičasy stopek přežijí překreslení pohledu;
- import podporuje pořadí `jméno.příjmení` i `příjmení.jméno` a odstraňuje koncová čísla účtů;
- legitimní jmenovce lze po potvrzení přidat nebo uložit;
- zkratky modulů používají `Alt + Shift + 1–9` a nekolidují s běžnými zkratkami prohlížeče;
- tlačítka se symboly dostávají smysluplné názvy, dialogy doplnily základní ARIA vazby a navigace `aria-current`;
- tisk skupin bez vytvořených skupin zobrazí srozumitelnou chybu.

## Výkon a konzistence

- rozsazování používá předpočítanou mapu studentů místo opakovaného lineárního hledání;
- náhodné rozhodování ve skupinovém algoritmu používá společný kryptografický generátor;
- limity historií jsou sjednoceny mezi enginy a sanitizací;
- top-level sanitizace už nepřenáší neznámé klíče.

## PWA a přístup

Instalace PWA je dostupná v Nastavení, pokud ji prohlížeč nabídne. Aplikace zůstává bezpečně fail-closed: nové spuštění vyžaduje online ověření přes centrální bránu AI Studia. Audit správně upozornil, že původní tvrzení o plném offline provozu nebylo pravdivé; lokální nepodepsaná „povolenka“ nebyla použita, protože by šla podvrhnout.

## Doplnění po porovnání paralelního balíku

- Nepřítomný student zůstávající ve starším zasedacím pořádku je zřetelně označen.
- Hromadná změna docházky aktualizuje čas změny u všech dotčených studentů.
- Do bezpečné kopie `last-good` se povýší pouze platný stav s podporovaným schématem.
- Kontrola verze v CI vychází přímo z `package.json`, takže nevznikne druhá ručně udržovaná hodnota.
