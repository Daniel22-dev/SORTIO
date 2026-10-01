# SORTIO 1.1.23 — Moje skupiny

Datum vydání: 2026-10-01

## Hlavní změna

SORTIO 1.1.23 umí používat centrální AI Studio „Moje skupiny“ jako kanonický zdroj identity a členství vyučovací skupiny. SORTIO si nadále ponechává vlastní provozní výukovou logiku a historii.

## Co je nové

- „Načíst z Moje skupiny“ a „Aktualizovat ze Studia“ v přehledu tříd.
- Bezpečný výběr centrální skupiny přes oficiální consumer API AI Studia.
- Synchronizace podle `groupId`, `revision` a stabilního `memberId`.
- Náhled diffu před potvrzením změn.
- Přidání, přejmenování, archivace a obnova člena bez destruktivní ztráty lokální historie.
- Uložení `sourceGroupId`, `lastSyncedRevision`, `lastSyncedAt` a mapování `canonicalMemberId` na lokální studentský záznam.
- Detekce stale revision, smazané/nedostupné skupiny, duplicitního napojení a konfliktů při párování.
- Explicitní jednorázová migrace existující lokální SORTIO třídy do AI Studia.
- Ruční import z IS zůstává plně zachovaný jako fallback.

## Soukromí a bezpečnost

- SORTIO nepřebírá školní e-mail studenta. Consumer projekce obsahuje pouze identitu člena, zobrazované jméno a stav.
- SORTIO nikdy nečte raw storage klíč AI Studia; používá oficiální `GHRAB_GROUPS` service/consumer API.
- Neplatný nebo datově příliš široký payload se odmítne fail-closed.
- Student names ani celý roster se neposílají do technické telemetrie nebo crash reportu.
- XSS-like jména a neplatné canonical payloady jsou odmítnuty validační vrstvou.

## Co zůstává výhradně v SORTIO

Docházka, losování a jeho historie, skupinové algoritmy, must-together/must-separate, level metadata, role a role history, zasedací pořádek a locky, engagement history, Lesson Board, skóre a další provozní stav.

## Kompatibilita

Pro centrální napojení je vyžadováno AI Studio **0.21.136 nebo novější**. Při nedostupné nebo nekompatibilní centrální službě zůstává SORTIO použitelné v local-only režimu.
