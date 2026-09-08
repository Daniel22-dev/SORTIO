# SORTIO 1.1.10 — rozsazení, diagnostika a knihovna pozadí

Datum: 8. 9. 2026

## Zasedací plán

- Editor učebny je zmenšen na reálný rozsah **3 sloupce × maximálně 7 dvojlavic**; políčka jsou díky tomu výrazně větší.
- Přidáno závazné pravidlo **„potřebuje sedět sám“**. Druhé místo u zvolené dvojlavice zůstane při automatickém rozsazení volné.
- Přidána volitelná preference **„Kluk + holka, pokud to půjde“**. Kategorie se nikdy neodvozuje automaticky ze jména; učitel ji nastavuje ručně jako Kluk / Holka / neurčeno.
- Volná místa jsou v pracovním nákresu a projekci barevně odlišena; jemné odlišení je zachováno i v PDF A4 naležato.
- Pravidla „od sebe“ zůstávají závazná, přední sezení zůstává preferencí a ruční/uzamčené pozice se zachovávají.

## Výukový panel – knihovna pozadí

- Kategorie pozadí byly rozšířeny a vyhledávací dotazy zjednodušeny, aby Wikimedia Commons vracela podstatně více použitelných výsledků.
- Při prvním hledání pozadí se automaticky načtou až tři stránky výsledků. Pokud je konkrétní kategorie stále příliš chudá, SORTIO použije širší tematický dotaz místo prázdné kategorie.
- Zůstává filtrování nevhodných portrétů, známek, dokumentů, log apod. a zobrazení celého obrázku bez ořezu.

## Stav aplikace a dat

- Horní stavový bod u verze je nyní skutečný indikátor: zelený = připraveno, oranžový = vyžaduje pozornost, červený = úložiště není dostupné.
- Karta datového trezoru má při zdravém stavu zřetelnou zelenou signalizaci.
- Produkční kontrola má viditelný procentuální průběh a název právě prováděného kroku; mezi kroky se uvolňuje vykreslování UI, takže prostředí nepůsobí zamrzle.

## O aplikaci

- Přidána přímo viditelná sekce **Changelog** s posledními verzemi a rozbalitelnou historií starších 1.1.x změn.

## Ochrana dat

Údaj Kluk/Holka je pouze ručně nastavená lokální párovací kategorie pro zasedací plán. SORTIO ji neodhaduje ze jména a nikam ji neodesílá.

## CI hotfix po prvním publish pokusu
GitHub interní regresní sada byla upravena tak, aby po přesunu produkčních nástrojů do lazy modulu kontrolovala vedle `index.html` a `app.js` také `lazy/production-tools.js`. Tím se odstraňují falešné FAIL kontrol `email-not-stored`, `diagnostics-privacy` a `demo`; runtime aplikace ani privacy chování se nemění.
