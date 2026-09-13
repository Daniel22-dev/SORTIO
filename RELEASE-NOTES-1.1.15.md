# SORTIO 1.1.15

Datum: 13. 9. 2026

## Účel vydání
Bezpečnostní migrace na GARP 2.5.1 SHIELD-PREP. Nejde o změnu učitelského workflow ani datového modelu.

## Hlavní změny
- Service worker explicitně rozlišuje security-critical runtime zdroje a obsluhuje je výhradně `network-only/no-store`.
- Bezpečnostně autoritativní soubory nejsou součástí aplikační precache ani platformní P3 precache.
- Přidán GARP 2.5.1 tooling, CycloneDX 1.7 SBOM, release-integrity/provenance/evidence podklady a negativní kontroly.
- School-server profil zůstává pouze připravený; SHIELD-LIVE není tímto balíkem potvrzen.

## Kompatibilita
- Datové schéma: beze změny.
- AI transport: žádný; AIR a agentic kontroly zůstávají N/A, dokud nebude AI cesta skutečně přidána.
- Reálná studentská data: tímto PREP kandidátem nejsou automaticky povolena.
