# SORTIO 1.1.11 — FINAL VALIDATION

Datum: 8. 9. 2026

## Rozsah vydání

Verze 1.1.11 zjednodušuje workflow zasedacího pořádku a omezuje uživatelský changelog na posledních 10 aktualizací.

### Zasedací pořádek
- Tvar učebny zůstává tvořen editorem 3 × 7 dvojlavic; jedna buňka představuje dvojlavici pro dva studenty.
- „Má sedět sám“ a „Má sedět vepředu“ jsou samostatné rozbalovací vícenásobné seznamy studentů.
- „Kluk + holka“ je volitelná preference. Párovací kategorie Kluk / Holka / Neurčeno se nastavují výslovně a ukládají local-first; aplikace je neodhaduje ze jména.
- Automatické rozsazení postupuje prioritně od tabule dozadu. Běžná neobsazená místa proto zůstávají v zadní části půdorysu; výjimkou jsou záměrně rezervovaná místa u studentů se samostatným sezením a ručně uzamčené pozice.
- Ve velkém plánu lze obsazené pozice přetahovat myší. Drop na obsazenou pozici provede přímé prohození studentů.
- Volná místa zůstávají vizuálně odlišena v aplikaci, projekci i PDF.

### Changelog
- UI „O aplikaci“ zobrazuje právě 10 posledních verzí: 1.1.11 až 1.1.2.
- Kořenový `CHANGELOG.md` obsahuje právě 10 posledních vydání. Starší technická historie zůstává v samostatných release notes.

### Výkon
- Nové styly zasedacího pořádku jsou načítány jako lazy `lazy/seating-ui.css` společně s lazy editorem.
- `entryCriticalBytes`: 549 764 / 550 000 — PASS.
- `precacheBytes`: 785 013 / 800 000 — PASS.

## Automatická validace

- `npm test` — PASS
- GHRAB Platform conformance — 108/108 PASS
- Lesson Board regressions — 45/45 PASS
- SORTIO 1.1.11 UX regressions — 43/43 PASS
- Package 3 runtime — PASS
- Package 4 runtime — PASS
- Package 5 runtime — PASS
- GARP security regressions — PASS
- GARP hostile render — PASS
- GARP canary sweep — PASS
- GARP suite-session regressions — 7/7 PASS
- Internal tests — 36/36 PASS
- P3 quality — 43/43 PASS
- XSS sink regression inventory — PASS
- School-server build — PASS

## Poznámka k párování Kluk + Holka

SORTIO záměrně neurčuje pohlaví/gender studenta pouze podle jména. Jméno není spolehlivý autoritativní údaj a takový odhad může být chybný. Učitel proto kategorii případně nastaví jednou přímo u třídy; údaj zůstává lokální v datech SORTIO. Pokud by v budoucnu školní informační systém poskytoval výslovný a oprávněně používaný strukturovaný údaj, lze řešit jeho řízený import samostatně.
