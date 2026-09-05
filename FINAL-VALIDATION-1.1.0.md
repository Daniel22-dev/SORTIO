# SORTIO 1.1.0 — finální validační stav

Datum: 2026-09-05

## Výsledek

Funkční rozšíření „Výukový panel“ je sestaveno a prošlo aktuální automatizovanou regresní a bezpečnostní sadou.

Po prvním GitHub publish pokusu byla opravena jedna CI regrese `email-not-stored`: při doplnění textu o Wikimedia byla změněna přesná bezpečnostní věta očekávaná interním testem. Datové chování se nezměnilo; po obnovení explicitní formulace interní sada prochází 35/35.

### PASS

- `npm test` — PASS;
- `test:internal` — 35/35 PASS po opravě `email-not-stored`;
- GHRAB Platform 1.1.2 conformance — 108/108;
- nový `test:lesson-board` — 30/30;
- doménové a package 3/4/5 testy — PASS;
- GARP security regressions — PASS;
- hostile-render — PASS, XSS canary nebyl vykonán;
- GARP canary cleanup — PASS;
- suite-session regressions — 5/5;
- P3 quality — 43/43 po vědomé aktualizaci výkonových rozpočtů pro verzi 1.1;
- P3 browser contract — PASS;
- XSS sink inventory — PASS, 28 `innerHTML` sinků proti baseline 29;
- error reporter statická/regresní sada — 51 PASS / 0 FAIL;
- school-server profile build — PASS.

## Omezení testovacího prostředí

Spravovaný Chromium v tomto prostředí blokuje přímou navigaci na HTTP/HTTPS/file URL (`ERR_BLOCKED_BY_ADMINISTRATOR`). Proto některé existující runtime testy používají svůj dokument-content/CDP bypass a nativní síťový průchod zde nelze ověřit stejným způsobem jako na běžném pracovním počítači. Toto omezení je evidováno i v suite-session test reportu.

## QR hlasování

Lokální hlasování je funkční bez serveru. Vícezařízení QR hlasování má dokončený frontend, mobilní vote stránku a API kontrakt. Pro skutečné telefony studentů vyžaduje implementaci endpointů na plánovaném školním serveru podle `docs/SORTIO-LIVE-POLL-API.md`; statické GitHub Pages nemají společný serverový stav.
