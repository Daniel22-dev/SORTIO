# SORTIO 1.1.11 — zjednodušené rozsazení

Datum: 8. 9. 2026

## Zasedací pořádek
- Pravidla „Má sedět sám“ a „Má sedět vepředu“ jsou nově samostatné rozbalovací vícenásobné seznamy studentů.
- Preference „Kluk + holka“ je samostatná rozbalovací sekce. Párovací kategorie se nastavují výslovně a local-first; aplikace je neodhaduje ze jména.
- Po kliknutí na „Rozsadit třídu“ se studenti umisťují prioritně od tabule dozadu. Nevyužitá běžná místa proto zůstávají vzadu.
- Velký plán už nepoužívá select v každém místě. Obsazená místa se přetahují myší; drop na obsazené místo oba studenty prohodí.
- Tvar mřížky lze stále upravit jako 3 × 7 dvojlavic a při rozsazení se aktuální tvar automaticky použije.

## Changelog
- Changelog v aplikaci i kořenovém `CHANGELOG.md` drží přesně posledních 10 verzí.

## Výkon a validace
- Styly zasedacího editoru jsou načítané lazy, aby nové workflow nepřekročilo výkonový budget aplikace.
- Kompletní testovací sada, interní testy, P3 quality, XSS kontrola a school-server build prošly.
