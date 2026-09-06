# SORTIO 1.1.4 – suite-session negative control

Bezpečnostní patch release pro koordinovanou GHRAB Platform 1.1.2 release wave.

- produkční suite-session cleanup a storage ownership zůstávají beze změny;
- regression harness nově povinně vytváří odhoditelnou oslabenou kopii bez skutečného cleanup handleru;
- stejná bezpečnostní podmínka musí na oslabené kopii skončit FAIL;
- bezprostředně poté se ověřuje čistý produkční kód, který musí skončit PASS;
- report ukládá SHA-256 produkční a oslabené kopie a používá pouze syntetický canary obsah.

Release wave zůstává kandidátní do společného ověření všech child aplikací v AI Studiu.
