# SORTIO 1.1.14 — Drawing board interaction fix

Datum: 9. 9. 2026

## Změny
- Opravena volba barvy ve widgetu **Tabule**: změna z color pickeru se uloží okamžitě a následující tah používá zvolenou barvu.
- Změna barvy už nevyvolává zbytečný rerender widgetu; obsluha poslouchá `input` i `change`, takže funguje spolehlivě v podporovaných prohlížečích.
- Tlačítko **Smazat** ve widgetu Tabule vyčistí kresbu okamžitě bez potvrzovacího dialogu.
- Potvrzení pro **Vyčistit panel** zůstává zachované, protože jde o odstranění všech widgetů z pracovní plochy.

## Kompatibilita
Datový model se nemění. Uložené pracovní plochy a kresby z 1.1.13 jsou přímo kompatibilní.
