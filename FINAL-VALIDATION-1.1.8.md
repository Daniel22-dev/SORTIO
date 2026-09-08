# SORTIO 1.1.8 — final validation

Datum: 8. 9. 2026

## Rozsah změny

- Nový zasedací plán začíná s prázdnou mřížkou (0 označených míst).
- Aplikace už automaticky nepředkresluje výchozí řady.
- U prázdného plánu je v nabídce předloh neutrální volba „Vyberte předlohu…“.
- Předloha se do mřížky vloží až po výslovné volbě učitele.
- Existující uložený tvar zasedacího plánu zůstává zobrazen beze změny.
- Datový model ani algoritmus rozsazování se nemění.

## Ověření

- `npm test` — PASS.
- GHRAB Platform conformance — 108/108 PASS.
- Lesson Board regressions — 42/42 PASS.
- SORTIO UX regressions — 27/27 PASS, včetně nové kontroly `fresh seating grid starts empty`.
- Package 3 runtime — PASS, včetně nepravidelného tvaru učebny.
- GARP security regressions — PASS.
- GARP hostile render — PASS.
- GARP canary sweep — PASS.
- GARP suite-session regressions — 7/7 PASS.
- `npm run build:school-server` — PASS.
- `npm run qa:quality` — 43/43 PASS, 0 warnings.
- Přímá runtime-unit kontrola: čerstvý plán vrací 0 buněk a existující uložený tvar se zachová — PASS.

## Výsledek

Kandidát SORTIO 1.1.8 je připraven k uživatelskému ověření. Změna je zpětně kompatibilní s existujícími zasedacími plány.
