# CI hotfix 2026-08-08 — visual QA

Verze aplikace zůstává 1.0.11.

Visual QA server nyní umí pro čistě testovací render odstranit Studio access bootstrap a odemknout chráněné skripty na vedlejších stránkách (zejména `manual/` a `tests/`). Produkční access gate ani runtime aplikace se tím nemění.


## H2 - scenario click stabilization

- Visual QA now waits until the access bootstrap leaves `checking` before interacting.
- Critical and Visual clicks dispatch against the current DOM node to avoid stale Playwright handles during application re-rendering.
- Preventive parity with the final Lesson Hub QA stabilization.
