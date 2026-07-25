# SORTIO 1.0.2 – oprava publikace manifestu

## Příčina selhání

GitHub Actions správně sestavil produkční soubory, ale interní regresní test následně odmítl vytvořený `dist/studio-manifest.json`.

Test `core/production-status` vyžaduje, aby český stav manifestu obsahoval výraz `Produkční`. Zdrojová šablona však uváděla `Připraveno k řízenému pilotu`, a proto workflow skončil s `exit code 1`. Kroky pro nahrání a nasazení GitHub Pages se už nespustily. AI Studio proto nedokázalo načíst novou živou verzi manifestu a použilo starší záznam ze záložního registru.

## Provedená oprava

- `status.cs` změněn na `Produkční školní verze`;
- `status.en` změněn na `Production school version`;
- do `verify-structure.mjs` byla přidána časná kontrola produkčního stavu, aby se stejný nesoulad příště odhalil už v prvním kroku workflow a s jasnou chybovou zprávou.

Hodnota `__APP_VERSION__` v souboru `src/studio-manifest.template.json` je správně. Jde o buildovací značku, kterou `scripts/build.mjs` při publikaci nahradí verzí z `package.json`.
