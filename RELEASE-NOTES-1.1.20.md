# SORTIO 1.1.20

## Typ vydání

Finální metadata/repository cleanup PATCH bez změny funkcí aplikace nebo datového modelu.

## Clean-up

- odstraněn zastaralý návod `NAHRANI-NA-GITHUB.md`, který popisoval ruční release cestu z verze 1.0.6;
- odstraněn kořenový archiv `SORTIO-1.1.17-GARP2.5-BUILD-INPUT-SOURCE.zip`; historické auditní evidence zůstávají zachované v dedikovaných adresářích;
- odstraněny duplicitní legacy workflow entrypointy P3/P4, které pouze opakovaly P5 práci a nejsou součástí required checks;
- aktivní UX regresní soubor je nově `scripts/ux-current-regressions.mjs`;
- SBOM generátor a verifier odvozují výchozí snapshot z aktuální `package.json` verze místo hard-coded PATCH čísla;
- README, architektura a release-acceptance metadata odpovídají aktuálnímu Safe Promotion / protected-main / AI Studio auto-patch workflow.

## Zachované hranice

Technicky GREEN release není automaticky organizační schválení školy pro použití ostrých studentských dat. `currentUseApproved` proto zůstává `false`. Historické GARP/SHIELD PREP evidence 1.1.17 se nepřepisují; zůstávají auditní stopou tehdejšího stavu.
