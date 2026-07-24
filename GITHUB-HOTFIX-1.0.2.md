# SORTIO 1.0.2 – oprava GitHub Actions

Tento balík opravuje nasazovací workflow bez změny funkčního kódu aplikace.

## Příčina předchozího pádu

Workflow po prvním `npm ci` spouštělo agregovaný příkaz `npm run qa:release`. Ten uvnitř znovu prováděl instalaci závislostí, síťový `npm audit` a všechny vizuální brány jako jeden blok. Výsledek byl zbytečně citlivý na síťové a prohlížečové podmínky GitHub runneru a při jediné pomocné kontrole zablokoval celé nasazení.

## Nový postup CI

Workflow nyní samostatně spouští:

1. produkční a doménové testy,
2. 35 interních regresních kontrol,
3. produkční build,
4. technickou, bezpečnostní, PWA a kombinatorickou bránu,
5. skutečný prohlížečový smoke test v Chromium,
6. ověření výsledného manifestu,
7. nasazení do GitHub Pages.

Síťový audit a rozsáhlá vizuální galerie již nejsou blokující součástí každého deploye. Zdrojové QA nástroje v projektu zůstávají zachovány pro samostatné hloubkové kontroly.
