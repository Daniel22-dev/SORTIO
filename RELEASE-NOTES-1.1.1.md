# SORTIO 1.1.1 – Workflow a UX Výukového panelu

Datum: 2026-09-05

Verze 1.1.1 opravuje workflow Výukového panelu podle reálného testování učitelem ve třídě. Nejde o přidání další vrstvy funkcí, ale o zjednodušení ovládání a opravu prvků, které byly v 1.1.0 příliš technické nebo neodpovídaly práci na projekci.

## Hlavní změny

- jedna pracovní plocha pro každou aktivní třídu; při přepnutí třídy se přepne i její uložená plocha;
- samostatný fullscreen celé pracovní plochy;
- oddělené zvětšování karty a obsahu uvnitř karty: pravý dolní úchyt mění kartu, levý dolní úchyt mění obsah; k dispozici zůstává i `A−`, `A＋` a Ctrl + kolečko myši;
- Timer přepracován na přímé nastavování minut a sekund pomocí `+ / −`, s větším Startem;
- nové lokálně generované zvuky: klasický zvonek, piano, kytara, xylofon, trubka a bubínek;
- Visual Timer se nastavuje tažením po kruhu 1–60 minut; opraven Reset a zvětšen Start;
- z hodin odstraněn alarm/zvuk;
- semafor zjednodušen na fyzický tříbarevný semafor bez textových popisků;
- kostky a mince mají skutečné vizuální objekty a animace při hodu;
- samostatný event countdown odstraněn z nabídky widgetů;
- knihovna Wikimedia Commons rozšířena na 50 výsledků na stránku s načítáním dalších výsledků a větším počtem tematických kategorií;
- opraveno a zpřehledněno nastavení obrázku jako pozadí pracovní plochy;
- import z IS automaticky doplňuje jednoznačnou českou diakritiku u běžných křestních jmen; příjmení zůstávají bezpečně v ručním/učícím se režimu;
- opravené zobrazení školního loga bez deformujícího filtru.

## Bezpečnost a kompatibilita

- GHRAB Platform zůstává 1.1.2;
- kontrakt `ghrab-suite-session-v1` zůstává beze změny;
- QR hlasování a serverový API kontrakt zůstávají zachovány;
- žádný mikrofon, kamera ani upload obrázků nebyly přidány;
- starší uložený widget event countdown lze ještě bezpečně načíst, ale nelze vytvořit nový.
