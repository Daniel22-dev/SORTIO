# CI hotfix 2026-08-08 — service-worker internal test

GitHub workflow `Verify and publish SORTIO` selhával v `scripts/package5-internal-tests.mjs` na kontrole `core / service-worker`.

Produkční service worker byl správný a build generoval cache `ghrab-sortio-v1.0.11`. Zastaralý interní test však stále očekával starý řetězec `sortio-v1.0.11` a implementační detail `startsWith(CACHE_PREFIX)`.

Test byl aktualizován na současný kontrakt:
- kanonická cache `ghrab-sortio-v1.0.11`,
- pole `CACHE_PREFIXES`,
- cleanup přes `CACHE_PREFIXES.some(...)`,
- zachování aktuální cache podmínkou `key !== CACHE_NAME`.

Produkční `src/sw.js` nebyl kvůli tomuto hotfixu měněn.
