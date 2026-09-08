# SORTIO 1.1.6

Datum: 7. 9. 2026

## Hlavní změny

- Aktivní třídu lze přepnout přímo na Přehledu; hledání studentů už při psaní neztrácí fokus.
- Vícenásobné losování používá výrazně větší a adaptivní jména.
- Skupiny před vytvořením ukazují očekávaný počet a velikosti; přibylo přímé promítnutí a „Znovu promíchat“.
- Role a témata lze přidělovat automaticky i ručně, včetně konkrétní role pro konkrétního studenta.
- Projekce už nenabízí starý pozůstatek „Původní třídní nástroje“ a skupinová témata/role jsou lépe čitelná.
- Zasedací pořádek vysvětluje orientaci vůči tabuli, průběžně počítá kapacitu a umožňuje drag & drop mezi místy.
- Zasedací pořádek má samostatná tlačítka Stáhnout PDF a Tisk; oba výstupy jsou připravené pro A4 naležato s povinným logem Gymnázia, Ostrava-Hrabůvka.
- Výukový panel drží fullscreen při běžných změnách, má viditelné volby barev, tlačítko Vyčistit panel a sjednocené škálování obsahu bez nežádoucích scrollbarů.
- Timer a Visual timer používají kompaktní Spustit/Pauza; výchozí velikosti Visual timeru, stopek, semaforu, kostek a skóre byly upraveny.
- Agenda se upravuje přímo v kartě bez prompt okna; spotlight zvětšuje hlavní obsah výrazněji.
- Obrázek pozadí vyplní celou pracovní plochu a widgety zůstávají nad ním.

## Poznámka k PDF

Tlačítko „Stáhnout PDF · A4 naležato“ vytvoří PDF přímo v prohlížeči a stáhne jej jako soubor. Samostatné tlačítko „Tisk · A4 naležato“ otevře odpovídající tiskový list. Oba výstupy používají stejné aktuální rozmístění žáků a logo školy.

## CI hotfix 2026-09-08
Po prvním nahrání 1.1.6 na GitHub překročil build čtyři P5 výkonové rozpočty. Bez navyšování limitů byl PDF/tiskový kód přesunut do offline-cachovaného lazy modulu a PWA ikony byly optimalizovány. Funkce zůstávají zachovány; P5 quality gate po opravě prochází 43/43.

## CI hotfix — P5 XSS sink regression (2026-09-08)
- P5 XSS inventář vrácen pod baseline bez změny bezpečnostního limitu: 28/29 `innerHTML`.
- Fullscreen Výukového panelu používá stabilní kontejner `#toolsWorkspace`, takže změna widgetu/pozadí neruší celou plochu a nevznikají nové HTML sinky.
- Přepínač třídy na Přehledu a tisková chybová obrazovka používají bezpečné DOM API.
