# SORTIO 1.1.5 – oprava suite-session negative controlu

CI hotfix pro koordinovanou GHRAB Platform 1.1.2 release wave.

- produkční suite-session cleanup, storage ownership a Platform 1.1.2 runtime zůstávají beze změny;
- opraven falešně navržený negative control z verze 1.1.4: pouhé nahrazení `session.onEnd()` nestačilo, protože SORTIO má záměrně i storage/pageshow/focus fail-safe cesty, které canary bezpečně uklidily;
- odhoditelná oslabená kopie nyní vypíná jediný skutečný cleanup primitive `performSuiteSessionCleanup()`, takže všechny lifecycle signály zůstávají aktivní, ale citlivý obsah se v negative controlu skutečně nesmaže;
- bezpečnostní podmínka na oslabené kopii musí skončit FAIL a čistý produkční kód bezprostředně poté PASS;
- disposable copy se vždy odstraní ve `finally`; report nadále ukládá SHA-256 produkční a oslabené kopie a používá pouze syntetická data.

Tato verze opravuje testovací/release harness. Nejde o oslabení produkčního zabezpečení.
