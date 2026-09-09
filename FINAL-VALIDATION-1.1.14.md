# FINAL VALIDATION — SORTIO 1.1.14

Datum: 9. 9. 2026

## Opravená regrese ve widgetu Tabule
- Volba barvy pera se ukládá okamžitě přes události `input` i `change`.
- Změna barvy nepřerenderuje celý widget; následující tah používá nově zvolenou barvu.
- Tlačítko **Smazat** ve widgetu Tabule vyčistí všechny tahy okamžitě bez potvrzovacího dialogu.
- Potvrzení pro **Vyčistit panel** zůstává zachované, protože jde o odstranění všech widgetů z pracovní plochy.
- Datový model ani formát záloh se nemění.

## Changelog
- UI i `CHANGELOG.md` obsahují přesně posledních 10 aktualizací: 1.1.14 až 1.1.5.

## Automatické kontroly
- `npm test`: PASS.
- Lesson Board regressions: 47/47 PASS.
- UX regressions: 46/46 PASS.
- GHRAB Platform conformance: 108/108 PASS.
- GHRAB quality budget: 43/43 PASS.
- Interní testy: 36/36 PASS.
- GARP security / hostile-render / canary / suite-session: PASS.
- XSS sink regression: PASS.
- Error reporter: 51 PASS / 0 FAIL.
- Technical QA: PASS, 0 nálezů.
- School-server build: PASS.

## Omezení prostředí
Spravovaná politika Chromium v tomto pracovním prostředí blokuje testovací URL (`URLBlocklist`), takže nebylo možné spustit interaktivní browser část Error Reporter QA. Tato skutečnost nesouvisí s opravou tabule; statické, doménové, regresní, bezpečnostní a buildové kontroly výše prošly.
