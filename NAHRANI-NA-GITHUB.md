# Nahrání opraveného SORTIO 1.0.3 na GitHub

## Proč předchozí zelené nasazení nestačilo

SORTIO se sice úspěšně nasadilo, ale jeho manifest uváděl stav `Produkční školní verze`. AI Studio GHRAB před formálním schválením školy takový stav záměrně odmítá a použije záložní registr. Proto řádek SORTIO zůstal oranžový i po zeleném workflow SORTIO.

## Správný postup

### 1. Nahrajte tento ZIP do repozitáře SORTIO

1. Otevřete čerstvě naklonovaný repozitář `Daniel22-dev/SORTIO`.
2. V jeho složce ponechte skrytou složku `.git`.
3. Rozbalte ZIP a vložte **obsah složky `SORTIO-main`** přímo do kořene repozitáře.
4. Commit například: `SORTIO 1.0.3 – kompatibilní stav manifestu pro AI Studio`.
5. Pushněte změny.
6. Počkejte, až workflow **SORTIO Verify and Deploy** skončí celé zeleně včetně kroku **Deploy to GitHub Pages**.

### 2. Potom znovu spusťte AI Studio

1. Otevřete repozitář `Daniel22-dev/AI-Studio-GHRAB`.
2. Přejděte na **Actions**.
3. Otevřete workflow **Sync, certify and deploy AI Studio GHRAB**.
4. Klikněte na **Run workflow** a spusťte větev `main`.
5. Po zeleném dokončení zavřete všechny otevřené karty AI Studia a otevřete Studio znovu.

## Očekávaný výsledek

V přehledu zdrojů se u SORTIO zobrazí:

- výsledek `Ověřeno`,
- načtená verze `1.0.3`,
- bez použití záložního registru.

Hodnota `__APP_VERSION__` ve zdrojové šabloně je správně. Build ji nahradí verzí z `package.json`.
