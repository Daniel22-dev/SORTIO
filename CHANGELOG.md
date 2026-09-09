# SORTIO changelog

V aplikaci i v tomto souboru se drží pouze posledních 10 vydaných aktualizací. Starší technická historie zůstává v samostatných `RELEASE-NOTES-*.md`.

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

## 1.1.9 — 2026-09-08
- Jedno políčko editoru představuje dvojlavici pro dva studenty.
- Nepravidelný tvar učebny se centruje v aplikaci, projekci i PDF.
- Wikimedia pozadí se zobrazuje celé bez ořezu a nevhodné encyklopedické motivy jsou potlačené.

## 1.1.8 — 2026-09-08
- Nový zasedací plán začíná prázdnou mřížkou bez automatického předkreslení.
- Rychlé tvary jsou volitelné a počet míst začíná na nule.

## 1.1.7 — 2026-09-08
- Odstraněny technické texty o cyklu z losování a projekce.
- Přidán mřížkový editor skutečného tvaru učebny a přímý PDF export A4 naležato.
- Opraven fullscreen Výukového panelu, pozadí a vizuál kostek.

## 1.1.6 — 2026-09-07
- Rychlejší přepínání tříd, lepší skupiny a role a drag & drop zasedacího pořádku.
- Rozšířen živý Výukový panel a projekce.

## 1.1.5 — 2026-09-06
- Opraven suite-session negative-control harness bez změny produkčního cleanupu.

## 1.1.4 — 2026-09-06
- Doplněn povinný suite-session negative control pro Platform 1.1.2.
