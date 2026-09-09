# SORTIO 1.1.12 — jednodušší zasedací pořádek

Datum: 8. 9. 2026

## Změny

- Odstraněna funkce **„Kluk + holka“** z ovládání zasedacího pořádku.
- Odstraněna související párovací logika z automatického rozsazování.
- SORTIO už neukládá párovací údaj `pairingSex` ani nastavení `mixedGenderPairing`.
- Starší local-first data a zálohy s těmito poli jsou nadále načitatelné; sanitizace je jednoduše ignoruje a při dalším uložení již nejsou součástí kanonického modelu.
- Zůstávají dvě explicitní pravidla: **„Má sedět sám“** a **„Má sedět vepředu“**.
- Po automatickém rozsazení lze studenty dál ručně přetahovat a vzájemně prohazovat myší.
- Changelog nadále drží pouze posledních 10 aktualizací (1.1.12–1.1.3).

## Důvod změny

Ruční klasifikace celé třídy kvůli jediné párovací preferenci zbytečně komplikovala běžný učitelský workflow. Ruční drag & drop je pro výjimečné požadavky rychlejší a přesnější.
