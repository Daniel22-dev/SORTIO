# SORTIO 1.0.14

Bezpečnostní kandidát po GARP 2.3 auditu.

- Přidána fail-safe detekce souběžné změny dat v jiné kartě prohlížeče.
- Zastaralá karta již nesmí bez varování přepsat novější `localStorage` stav; konflikt se odmítne a načte se novější stav.
- Doplněna regresní evidence pro multi-tab kolizi a negative control v rámci GARP auditu.
- Beze změny pedagogického workflow a bez AI přenosu dat.
