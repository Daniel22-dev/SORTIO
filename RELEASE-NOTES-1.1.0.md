# SORTIO 1.1.0 — Výukový panel

Datum: 2026-09-05

## Smysl verze

SORTIO se rozšiřuje z nástroje pro organizaci třídy na **Výukový panel** určený i pro řízení živé hodiny. Původní třídní funkce zůstávají zachovány; nová pracovní plocha funguje i bez vybrané třídy.

## Nová pracovní plocha

- více pojmenovaných scén hodiny;
- přesouvání a změna velikosti widgetů;
- zamknutí, duplikace, smazání a spotlight;
- barevná i obrazová pozadí;
- samostatný bezpečný projekční režim nové plochy.

## Nové a rozšířené widgety

- Timer s +/- ovládáním, presety a výběrem zvuku;
- Visual timer;
- Stopky s mezičasy;
- Analogové/digitální hodiny s alarmem;
- Semafor s vlastními popisky;
- Kreslicí tabule;
- Rozšířené kostky, mince, čísla, písmena a vlastní textové volby;
- Týmové skóre s možností načíst aktuální skupiny SORTIO;
- Text, režim práce, obrázek, event countdown, agenda;
- Hlasování a QR odkaz.

## Knihovna obrázků

- žádný upload obrázků uživatelem;
- vyhledávání a tematické kategorie nad Wikimedia Commons;
- použití obrázku jako widgetu nebo pozadí;
- uchování a zobrazení zdroje/licence;
- třídní data se do Wikimedia neposílají.

## Hlasování

- lokální hlasování na projekci funguje bez serveru;
- připraven anonymní QR režim pro školní server;
- veřejná mobilní stránka `/poll/` pro studentské telefony;
- živé načítání výsledků přibližně po 1,8 s;
- ukončení ankety počítá se serverovým close endpointem;
- žádné jméno, e-mail ani ID studenta není součástí kontraktu;
- serverový kontrakt je popsán v `docs/SORTIO-LIVE-POLL-API.md`.

## Bezpečnost a kompatibilita

- zachována GHRAB Platform 1.1.2 a `ghrab-suite-session-v1`;
- nová data pracovní plochy používají stávající aplikační datový trezor, takže jsou pokryta úklidem „Ukončit práci“;
- CSP explicitně povoluje pouze potřebné Wikimedia endpointy pro obrázkovou knihovnu;
- mikrofon zůstává zakázaný; měřič hluku nebyl přidán;
- původní správa tříd, import, losování, skupiny, role, místa, historie a zálohy zůstávají zachovány.
- kvůli novému widgetovému modulu byly vědomě aktualizovány dva P3 výkonové rozpočty: `entryCriticalBytes` 450 → 550 kB a `precacheBytes` 680 → 800 kB; limity celkového buildu a největšího souboru zůstaly beze změny.

## CI hotfix po prvním publish pokusu

První GitHub deploy verze 1.1.0 zastavila interní kontrola `email-not-stored`. Příčinou nebylo ukládání e-mailů, ale změna přesné bezpečnostní formulace v informační kartě při doplnění textu o Wikimedia Commons. Původní explicitní věta byla obnovena a doplněk o Wikimedia zachován. Po opravě interní sada prochází 35/35.
