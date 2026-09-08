# SORTIO 1.1.9 — dvojlavice, centrování a obrazová pozadí

Datum: 8. 9. 2026

## Zasedací plán

- Mřížka vlastního tvaru nyní reprezentuje skutečné dvojlavice: jedno označené políčko = 2 studentská místa.
- Kapacita učebny se přepočítává automaticky jako počet označených lavic × 2.
- Nepravidelné řady, uličky a mezery zůstávají zachované.
- Celý půdorys se normalizuje a vystřeďuje v hlavní ploše, projekci i PDF A4 naležato.

## Výukový panel

- „Vyčistit panel“ používá vlastní potvrzovací modal a zachovává fullscreen.
- Tlačítko „Promítnout“ má vynucenou viditelnou primární podobu.
- Barevné miniatury pozadí mají explicitní výplně a nejsou závislé na zděděných theme stylech.

## Obrázky a pozadí

- Pozadí z Wikimedia Commons jsou řazena podle vhodnosti pro projekční plochu: široký formát, scenérie, příroda, města, architektura, roční období a barevné motivy mají přednost.
- Portréty, známky, mince, obrazovky, dokumenty, loga a podobné encyklopedické motivy jsou potlačeny.
- Vybraný obrázek se **nezvětšuje ořezem**: celý snímek je vidět pomocí `contain`; pozadí za ním tvoří rozostřená kopie stejného snímku, takže nevzniká nepříjemná prázdná plocha.
- Knihovna médií je načítána lazy, aby zůstal zachovaný výkonový budget aplikace.

## Kompatibilita

Datový model zachovává načtení starších zasedacích plánů. Nově vytvořené vlastní plány používají metadata dvojlavic (`deskRow`, `deskColumn`, `deskSlot`).
