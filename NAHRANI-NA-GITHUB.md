# SORTIO 1.0.2 – nahrání na GitHub

Balík obsahuje kompletní repozitář. Starší verze ani předchozí balíčky se nenahrávají.

## Nahrání

1. Otevřete repozitář `SORTIO`.
2. Rozbalte `SORTIO-1.0.2-GITHUB-READY.zip`.
3. Nahrajte celý obsah rozbalené složky přímo do kořene repozitáře.
4. Potvrďte přepsání starších souborů.
5. Commit pojmenujte například `SORTIO 1.0.2 – produkční školní verze`.
6. V GitHub Actions počkejte na zelené workflow **SORTIO QA and Deploy**.
7. V Settings → Pages ponechte zdroj **GitHub Actions**.

## Povinná kontrola po nasazení

1. Otevřete `/tests/` a ověřte, že všechny testy prošly.
2. V Nastavení vytvořte anonymní ukázkovou třídu.
3. Spusťte produkční kontrolu – všech osm položek musí být zelených.
4. Vytvořte skupiny, role a zasedací pořádek.
5. Otevřete bezpečnou projekci a ověřte, že neukazuje interní profily.
6. Stáhněte zálohu a znovu ji načtěte.
7. Ověřte tlačítko „Vrátit stav před importem“.
8. Vyzkoušejte tisk kartiček a uložení jako PDF.
9. Ověřte nabídku instalace PWA a načtení cachovaných prostředků; nové spuštění aplikace stále vyžaduje online ověření přes AI Studio.

## AI Studio

Tento balík AI Studio neaktualizuje. SORTIO se do Studia doplní až nad aktuální stabilní verzí po dokončení ACTIVA.
