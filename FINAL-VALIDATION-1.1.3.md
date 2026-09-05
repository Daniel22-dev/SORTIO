# FINAL VALIDATION — SORTIO 1.1.3

Datum: 2026-09-05

## Změna

- Viditelné tlačítko `Manuál` v horní liště aplikace.
- Otevírá `./manual/` v nové kartě (`target="_blank"`, `rel="noopener"`).
- Dialog Zkratky vysvětluje účel tlačítka.
- Runtime regresní test `manual-entry` hlídá jeho přítomnost.

## Ověření

- `npm test`: PASS
- GHRAB Platform conformance: 108/108 PASS
- Výukový panel regressions: 42/42 PASS
- Interní runtime testy: 36/36 PASS
- `qa:quality`: 43/43 PASS
- `qa:xss`: PASS (innerHTML 28 <= baseline 29)
- `build:school-server`: PASS

GHRAB Platform zůstává 1.1.2; suite-session kontrakt zůstává `ghrab-suite-session-v1`.
