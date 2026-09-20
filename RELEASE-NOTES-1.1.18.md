# SORTIO 1.1.18

## Typ vydání

Infrastrukturní PATCH bez změny aplikačních funkcí nebo datového modelu.

## Změny

- doplněn Safe Promotion řetězec candidate → P5 → PR → protected main;
- produkční deploy je navázán na GREEN P5 z main;
- doplněny fail-closed kontroly SAFE_PROMOTION_TOKEN a AI_STUDIO_DISPATCH_TOKEN;
- doplněna přesná release identity podle kontraktu ghrab-release-integrity-v2;
- release identity váže appId, verzi, source commit, artifact digest, manifest, SBOM, build provenance a security evidence;
- po deployi se ověřuje skutečně publikovaná live verze před odesláním app-updated do AI Studia;
- doplněny regresní kontroly Safe Promotion a auto-patch notifikační topologie;
- zachován GARP 2.5.1 / N5 fail-closed profil a GHRAB Platform 1.1.2.

## Oprava release pipeline

Po prvním bootstrap merge byla opravena verze v reporter regresním testu a verzovaná dokumentace tak, aby odpovídaly 1.1.18. Samotná aplikace ani její funkční chování se touto opravou nemění.
