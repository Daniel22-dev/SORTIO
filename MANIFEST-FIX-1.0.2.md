# SORTIO 1.0.2 – finální oprava synchronizace manifestu

## Skutečná příčina

První chyba byla v interním testu SORTIO, který vyžadoval slovo `Produkční`. Po jeho splnění sice workflow SORTIO prošlo, ale vznikl opačný problém: AI Studio GHRAB má bezpečnostní pravidlo, které před schválením školy odmítá `produkční` nebo `production` přímo v poli `status` manifestu.

Výsledkem bylo úspěšné nasazení SORTIO, ale neúspěšná synchronizace do AI Studia a použití staršího záložního záznamu.

## Finální řešení

- `status.cs`: `Připraveno k řízenému pilotu`;
- `status.en`: `Ready for controlled pilot`;
- interní test SORTIO nyní ověřuje kompatibilitu s řízeným pilotem;
- časná kontrola struktury kopíruje pravidlo AI Studia a zakazuje produkční tvrzení pouze v poli `status`;
- uživatelské označení školního stavu bylo sjednoceno s řízeným pilotem;
- po nasazení SORTIO je nutné ručně spustit synchronizační workflow AI Studia, protože registr se vytváří při buildu AI Studia.
