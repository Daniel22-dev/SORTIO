# SORTIO 1.0.16 — uzavření druhé GARP 2.3 kontroly

Datum: 2026-09-03

Tato verze navazuje na nezávislou druhou kontrolu kandidáta 1.0.15. Nemění účel aplikace ani datový model; uzavírá dva nízké nálezy z kola 2.

## Bezpečnost a integrita dat

- N-08: persistentní cesta `loadData()` nyní opravuje kolize interních identifikátorů deterministickou deduplikací místo sloučení dvou záznamů do jedné identity.
- Při kolizi dvou různých původních ID se zachovají dvě odlišné bezpečné identity a přemapují se studentní reference (sezení, skupiny, losování, engagement, role a pravidla).
- Importní hranice zůstává fail-closed: kolizní záloha je nadále odmítnuta jako `BACKUP_DUPLICATE_IDENTIFIER`.
- Unikátnost se při obnově z persistentního stavu opravuje také pro třídy, skupiny, místa, engagement záznamy, týmová skóre a historické záznamy.

## Automatické bezpečnostní brány

- N-09: `test:garp-hostile-render` a `test:garp-canary` jsou součástí `npm test`.
- Oba testy jsou také součástí `qa:p5:ci`, takže CI chrání behaviorální XSS opravu i privacy canary automaticky.

## Release poznámka

Verze 1.0.16 vznikla po druhé nezávislé Claude kontrole. Protože došlo k nové změně distribuovaného kódu a konfigurace testů, nelze podle GARP 2.3 tvrdit, že tato konkrétní verze má nezávisle uzavřený Release Integrity GREEN bez nového výslovně zahájeného ověřovacího cyklu. Stav musí zůstat pravdivě AMBER, dokud uživatel takový nový cyklus výslovně nezahájí.
