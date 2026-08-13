## 1.0.12 — sjednocení reportéru (2026-08-13)

- Reportér používá dvoukrokové vytvoření a skutečné stažení diagnostického ZIPu; Gmail je dostupný až po kliknutí na stažení.
- Rozhraní i e-mail vyžadují ruční přiložení ZIPu a pomocné video je bezpečně skryté uvnitř reportéru i při scrollování.
- Regresní sada fyzicky ověřuje stažený ZIP, jeho snímky a diagnostiku, jednu instanci reportéru, motivy, mobilní zobrazení a klávesnici.
- Funkce organizace třídy ani lokální data nebyly změněny; PWA cache je `ghrab-sortio-v1.0.12`.

## 1.0.11 — P5 (2026-08-05)
### CI hotfix 2026-08-08
- Visual QA používá pouze v testovacím serveru odemčenou podobu chráněných HTML stránek, aby přímé testování `manual/` a `tests/` nepadalo na nedostupném Studio bootstrapu.



## 1.0.11 — P5 R2

- Opraven reflow projekčního dialogu a manuálu na 320 px.
- P5 R2 runtime audit se skripty a odemčeným UI.


- Předprodukční akceptace bez povinného školního serveru.
- Nulové otevřené automatické a11y nálezy jsou podmínkou P5 brány.
- Přidán aktualizovaný release-acceptance kontrakt a odložený GitHub upload.

# Changelog

## 1.0.9 — P4 FINAL (2026-08-04)

- Finální certifikace, čisté buildy, přístupnost, výkon, bezpečnost a release evidence.
- Přidána povinná `qa:p4:ci` brána.

## 1.0.8 - 2026-08-04 (P3)

- Platforma 1.1.0, pristupnost, performance budgety a modularizace P3.

## 1.0.7 — P2: sjednocení platformy GHRAB (2026-08-04)

- jeden kanonický školní logotyp a jednotná autorská patička;
- GHRAB Platform 1.0.0: motiv, storage namespace s vratnou migrací, Studio Bridge 2.0 a artifact envelope v1;
- jednotný název PWA cache `ghrab-sortio-v1.0.7` a řízená aktualizace;
- platformní konformitní test je součástí buildu a CI.


## 1.0.6 — P1 (2026-08-04)

- Produkční bezpečnost, serverový profil, datové manifesty a jednotná observability vrstva.
- AI Core: not-applicable; společná serverová platforma bez AI transportu.

# Changelog

## 1.0.5 — 2026-08-04

- Etapa P0: odstraněn nebezpečný cache-first režim bezpečnostních zdrojů a HTML fallback pro JS/JSON, doplněno stabilní PWA id a server-ready deployment kontrakt.
## 1.0.4 — 2026-08-03

- zavedena jediná lokální instance společného reportéru AI Studia;
- centrální reportér app-guardu je vypnut přes `errorReporter: false`;
- motiv se živě odvozuje z `html[data-theme]` a plovoucí prvky respektují toastovou oblast;
- PWA cache, manifest, release workflow a centrální návod byly aktualizovány.

Starší podrobnosti jsou v `RELEASE-NOTES-*.md`.
