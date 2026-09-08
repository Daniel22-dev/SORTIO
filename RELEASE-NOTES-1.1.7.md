# SORTIO 1.1.7

Datum: 8. 9. 2026

## Hlavní změny

- Losování už ve výsledku ani v projekci nezobrazuje technické stavové texty typu „V cyklu zbývá…“ nebo „Cyklus je dokončen“. Interní mechanismus výběru bez opakování zůstává zachován.
- Modul „Místa“ je přejmenován na **Zasedací plán**.
- Předvolby zasedacího plánu mají srozumitelnější názvy: **Souvislé řady**, **Dvojmístné lavice s uličkami**, **Skupinové stoly (ostrůvky)** a **Uspořádání do U**.
- Číselné zadávání řad a lavic nahradil **mřížkový editor tvaru učebny**. Učitel kliknutím nebo tažením označí skutečná místa; jednotlivé řady mohou mít rozdílnou délku a mezi místy mohou zůstat mezery či uličky. Celkový počet míst se přepočítává automaticky.
- Vlastní tvar učebny se ukládá do datového modelu a zachovává skutečné souřadnice míst pro ruční přesuny, projekci i PDF.
- U zasedacího plánu byla odstraněna samostatná volba **Tisk**. Zůstává **Promítnout** a přímý **Exportovat PDF · A4 naležato** s povinným logem školy.
- Tlačítko **Promítnout** ve Výukovém panelu má opět zřetelný primární vzhled.
- Miniatury barevných pozadí mají explicitní náhledy a nejsou přepisovány obecným stylem tlačítek.
- Obrázek z Wikimedia Commons se na pracovní ploše i v projekci vykresluje jako samostatná sanitizovaná obrazová vrstva; zdroj a licence zůstávají zachovány.
- **Vyčistit panel** ve fullscreen režimu používá dvoukrokové potvrzení přímo v tlačítku, takže prohlížeč neopouští fullscreen kvůli systémovému `confirm()` dialogu.
- Puntíky na kostce D6 jsou větší a více roztažené do plochy kostky.
- Stav datového trezoru už nepovažuje čerstvou instalaci bez dosud vytvořené bezpečné kopie za chybu. Oranžové „Vyžaduje pozornost“ se zobrazí pouze při skutečně neplatném existujícím zápisu, chybě zápisu nebo nedostupném úložišti.

## Kompatibilita

- Stávající zasedací plány ve starších režimech zůstávají načitatelné.
- Nový vlastní tvar používá typ `custom`; existující algoritmy rozsazení, pravidla „od sebe“, ruční drag & drop, projekce a PDF export pracují nad konkrétními souřadnicemi míst.
- Local-first ukládání, GHRAB Platform 1.1.2, školní branding a bezpečnostní sanitizace Wikimedia URL zůstávají zachovány.
