# SORTIO 1.0.2 – stabilní GitHub workflow

Tato varianta odstraňuje křehké části předchozího workflow:

- GitHub Actions neprovádí `npm ci` ani žádné síťové stahování npm balíčků;
- neinstaluje Playwright/Chromium;
- používá pouze deterministické produkční, doménové, interní a QA kontroly;
- build a GitHub Pages deployment probíhají v jediném jobu;
- v `.github/workflows` je pouze `deploy.yml`.

Před nahráním byl lokálně ověřen build a všechny deterministické kontroly.
