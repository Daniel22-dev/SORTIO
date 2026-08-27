# SORTIO 1.0.13 — GARP bezpečnostní kandidát

Datum: 27. 8. 2026

Tato patch verze nemění pedagogické funkce ani datový formát. Zpřísňuje přístupový bootstrap, konfiguraci offline/fail-closed režimu, PWA zacházení s bezpečnostní konfigurací a CI supply-chain kontrolu.

## Bezpečnostní změny

- nedostupná deployment konfigurace již nevytvoří provozní fallback; aplikace zůstane zamčená,
- chráněný kód se nespustí pouze na základě boolean výsledku centrální brány, ale vyžaduje zachycené oprávnění pro SORTIO,
- produkční a školní profil používají aktuální `sharedAccessVersion`,
- produkční konfigurace výslovně omezuje offline LKG na 24 hodin a stáří podepsaného bundle na 30 dní,
- service worker neprecachuje deployment konfigurace a jejich varianty obchází jako runtime-only,
- school-server profil používá `server-session` a `allowLocalProviderKeys: false`,
- GitHub Actions jsou připnuté na konkrétní commit SHA,
- nová bezpečnostní regrese `test:garp-security` je součástí standardního testu i P5 release gate.

## Známé omezení

Produkční CSP nadále obsahuje `unsafe-inline`, protože současný build skládá významnou část aplikace do inline chráněného skriptu a používá inline styly. Odstranění vyžaduje samostatnou architektonickou změnu a nebylo provedeno v bezpečnostním patchi, aby se svévolně neměnil runtime a vzhled aplikace.
