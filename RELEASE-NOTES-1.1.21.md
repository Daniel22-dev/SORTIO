# SORTIO 1.1.21 — GARP 2.7 migration

Datum: 2026-09-25

## Co se mění

- GARP 2.7 r2/G-02 je nově jediná aktivní aplikační bezpečnostní autorita.
- GARP 2.5.1/N5 zůstává zachován jako regresní baseline a nadále se spouští v QA.
- Přidán je přesně připnutý konsolidovaný GARP 2.7 referenční balík, aplikační policy, capability inventory, migration profile, live status a trust anchor.
- Přidány jsou contract, architecture-integrity, policy mutation a application mutation brány.
- GitHub Pages release identity i `app-updated` dispatch do AI Studia deklarují `GARP-2.7`.
- School-server profil vyžaduje live validaci a zůstává `DEFERRED/NOT_TESTED`, dokud není reálně nasazen a ověřen.

## Co se nemění

- classroom workflow a UI SORTIO;
- datový model a local-first ukládání;
- nulová generativní AI boundary;
- explicitně omezený Wikimedia Commons egress;
- Safe Promotion, release-integrity a rollback/auto-patch řetězec.

## Bezpečnostní poznámka

Tato verze nezavádí nový školní server ani netvrdí, že serverové kontroly byly otestovány. GARP 2.7 vrstva je fail-closed a serverová evidence musí vzniknout až v reálném prostředí.
