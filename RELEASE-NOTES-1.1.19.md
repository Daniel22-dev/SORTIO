# SORTIO 1.1.19

## Typ vydání

Infrastrukturní PATCH bez změny aplikačních funkcí nebo datového modelu.

## Oprava release identity

- `release-integrity.json` už nezahrnuje `.nojekyll`;
- `.nojekyll` je GitHub Pages deployment marker, který se při publikaci spotřebuje a není veřejně dostupný přes HTTP;
- veřejná release identity tak nyní popisuje přesně ty soubory, které lze z live deploymentu nezávisle stáhnout a hashově ověřit;
- zachována je vazba na appId, verzi, source commit, artifact digest, manifest, SBOM, build provenance a security evidence manifest;
- Safe Promotion, P5, GARP 2.5.1/N5 a AI Studio dispatch zůstávají fail-closed.

## Důvod nové PATCH verze

Verze 1.1.18 byla již zveřejněna na GitHub Pages. Oprava mění bajty release artefaktu, proto je vydána jako 1.1.19 namísto přepsání již publikované verze.
