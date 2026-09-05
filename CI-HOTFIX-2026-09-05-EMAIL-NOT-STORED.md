# CI hotfix 2026-09-05 — email-not-stored

První GitHub publish pokus SORTIO 1.1.0 skončil v kroku `Run internal regression suite` na kontrole `import/email-not-stored`.

## Příčina

Při rozšíření informační karty o externí obrazovou knihovnu Wikimedia byla původní explicitní bezpečnostní věta zkrácena. Datové chování se nezměnilo a e-mailové adresy se nepersistovaly, ale interní regresní test záměrně vyžaduje přesnou deklaraci:

> Importované e-mailové adresy se po vytvoření náhledu neukládají.

## Oprava

Přesná věta byla obnovena v `src/body.html`; informace o Wikimedia zůstává uvedena jako navazující věta.

## Ověření

- `npm test` — PASS
- `npm run test:internal` — 35/35 PASS
- GHRAB Platform 1.1.2 — 108/108
- `npm run build:school-server` — PASS

Verze zůstává 1.1.0, protože předchozí publish pokus skončil před nasazením.
