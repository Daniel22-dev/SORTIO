# Nahrání opraveného SORTIO 1.0.2 na GitHub

## Doporučený postup přes GitHub Desktop

1. Otevřete čerstvě naklonovaný repozitář `Daniel22-dev/SORTIO`.
2. V jeho složce ponechte pouze skrytou složku `.git`.
3. Rozbalte tento ZIP a vložte **obsah složky `SORTIO-main`** přímo do kořene repozitáře.
4. Ověřte, že soubor `.github/workflows/deploy.yml` existuje a v `.github/workflows` není jiné staré workflow.
5. Vytvořte commit například `SORTIO 1.0.2 – oprava produkčního manifestu`.
6. Klikněte na **Push origin**.
7. V GitHub Actions otevřete workflow **SORTIO Verify and Deploy**.
8. Po úspěšném dokončení musí projít i krok **Run internal regression suite** a následně **Deploy to GitHub Pages**.

## Co bylo opraveno

Původní manifest uváděl stav `Připraveno k řízenému pilotu`, ale interní test vyžadoval produkční stav. Workflow proto končilo před nasazením GitHub Pages. Opravený manifest používá stav `Produkční školní verze`.

Hodnota `__APP_VERSION__` v `src/studio-manifest.template.json` je záměrná buildovací značka. Při sestavení ji skript automaticky nahradí verzí `1.0.2` z `package.json`.
