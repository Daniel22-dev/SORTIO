# SORTIO 1.0.5

**Datum:** 2026-08-04
**Etapa:** P0 – odolný start, bezpečná aktualizace a server-ready základ

## Změny

Kritická oprava service workeru: centrální bezpečnostní zdroje se nezmrazují a ne-HTML požadavek nikdy nedostane index.html. Doplněno stabilní PWA id, plné obnovení atributů skriptů a server-ready deployment.

## Hranice etapy

Serverový P0 build neobsahuje tajné údaje a nepředstírá hotovou serverovou autentizaci ani AI gateway. Aktivní zůstává kompatibilní podepsaný permit a dosavadní AI transport; cílový profil je přiložen jako šablona pro P1.

## Data uživatele

P0 nemění obsahové prompty ani záměrně nemigruje uložená uživatelská data. Před nasazením se přesto doporučuje vytvořit zálohu současného repozitáře a u aplikací s lokálními daty exportovat důležitou práci.
