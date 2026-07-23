# SORTIO – Organizátor třídy

**Verze 1.0.1 · produkční školní verze**

SORTIO je local-first aplikace pro rychlou organizaci třídy: import seznamu z IS, docházka, losování, chytré skupiny, role, zasedací pořádek, bezpečná projekce, třídní nástroje, historie zapojování a tiskové/PDF výstupy.

## Hlavní zásady

- e-mailové adresy jsou pouze dočasným vstupem importu a neukládají se;
- data studentů neopouštějí prohlížeč;
- projekční režim neukazuje interní profily, pravidla ani preference míst;
- diagnostický protokol neobsahuje jména studentů;
- zálohy se ověřují kontrolním součtem;
- při poškození primárního zápisu se použije poslední bezpečný stav.

## SORTIO 1.0 obsahuje

- správu tříd, archiv a aktualizaci seznamu z IS;
- losování bez opakování a vrácení posledního výběru;
- náhodné, vyvážené, homogenní a historicky promíchané skupiny;
- pravidla „spolu“, „od sebe“ a připnutí do skupiny;
- spravedlivou rotaci rolí a přidělování témat;
- zasedací pořádek pro řady, dvojice, ostrůvky a U;
- časovač, stopky, skóre a rozhodovací nástroje;
- bezpečný projekční režim;
- tisk skupin, míst, historie a kartiček;
- datový trezor v5, záchrannou kopii a vratný stav před importem;
- anonymní ukázkovou třídu;
- produkční diagnostiku a interní testovací centrum;
- PWA a offline provoz;
- klávesové zkratky, viditelný fokus a omezení animací.

## Vývoj a QA

```bash
npm ci
npm test
npm run test:domain
npm run test:package3
npm run test:package4
npm run test:package5
npm run build
npm run qa:release
```

GitHub Actions automaticky instalují Chromium, spouštějí úplnou GHRAB QA bránu a nasazují složku `dist/` na GitHub Pages.

## Nasazení

Obsah ZIPu nahrajte do kořene samostatného repozitáře `SORTIO`. GitHub Pages musí používat **GitHub Actions**, nikoli nasazení z větve.

**AI Studio není součástí tohoto balíčku.** Integrace SORTIO proběhne později nad nejnovější stabilní verzí AI Studia po dokončení ACTIVA.
