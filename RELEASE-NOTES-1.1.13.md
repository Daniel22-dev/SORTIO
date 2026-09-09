# SORTIO 1.1.13 — Seating rule multi-select fix

Datum: 9. 9. 2026

## Změna
- Rozbalovací seznamy **Má sedět sám** a **Má sedět vepředu** už po zaškrtnutí studenta nezmizí.
- Učitel může v jednom otevřeném seznamu zaškrtnout více studentů po sobě.
- Změna preference se stále okamžitě a local-first uloží, ale nevyvolá zbytečný rerender celé trasy zasedacího pořádku.
- Ostatní změny dat nadále používají standardní renderovací mechanismus.

## Kompatibilita
Datový model se nemění. Zálohy a zasedací plány z 1.1.12 jsou přímo kompatibilní.
