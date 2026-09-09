# SORTIO 1.1.12 — FINAL VALIDATION

Datum: 8. 9. 2026

## Rozsah změny

Verze 1.1.12 odstraňuje celou funkci „Kluk + holka“ ze zasedacího pořádku. Z aplikace byla odstraněna uživatelská volba, ruční klasifikace studentů, související algoritmická preference i kanonická uložená pole `pairingSex` a `mixedGenderPairing`.

Zasedací workflow zůstává založené na:

- vlastním tvaru učebny 3 × 7 dvojlavic;
- pravidle „Má sedět sám“;
- pravidle „Má sedět vepředu“;
- automatickém plnění od tabule dozadu;
- ručním drag & drop přesunu a prohození studentů ve velkém plánu.

Starší data a zálohy obsahující dnes již nepoužívaná párovací pole zůstávají načitatelné. Sanitizace je ignoruje a při dalším kanonickém uložení se již nezapisují.

Uživatelský changelog obsahuje přesně posledních 10 aktualizací: 1.1.12 až 1.1.3.

## Ověření

- `npm test` — PASS
- GHRAB Platform conformance — 108/108 PASS
- Lesson Board regressions — 45/45 PASS
- SORTIO UX regressions — 43/43 PASS
- interní testy — 36/36 PASS
- GHRAB quality — 43/43 PASS
- GARP security regressions — PASS
- hostile render — PASS
- canary sweep — PASS
- suite-session regressions — 7/7 PASS
- XSS sink audit — PASS
- school-server build — PASS

## Výsledek

Kandidát 1.1.12 je připraven k nahrání do repozitáře a k následnému CI ověření.
