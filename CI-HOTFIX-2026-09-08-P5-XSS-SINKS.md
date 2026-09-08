# CI hotfix 2026-09-08 — P5 XSS sink regression

GitHub P5 R2 gate po vydání SORTIO 1.1.6 CI-FIX selhával na XSS sink inventáři: `innerHTML` 32 > baseline 29.

Oprava nezvyšuje baseline. Nové sinky byly odstraněny:
- Přehled: dynamický přepínač aktivní třídy se skládá bezpečnými DOM API (`textContent`, `createElement`, `replaceChildren`).
- Výukový panel: fullscreen nyní drží stabilní `#toolsWorkspace`, takže běžný rerender může vyměnit obsah bez ručního `innerHTML` refresh helperu a fullscreen zůstává aktivní.
- PDF/tisk: chybová hláška při nedostupném povinném logu používá DOM API místo `document.body.innerHTML`.

Výsledek `npm run qa:xss`: 28 `innerHTML` proti baseline 29, status PASS.
