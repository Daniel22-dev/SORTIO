# SORTIO Live Poll API – kontrakt pro školní server

Frontend SORTIO 1.1 obsahuje plnou projekční část hlasování a veřejnou mobilní stránku `/apps/sortio/poll/`. Pro skutečné hlasování více zařízení je potřeba krátkodobý serverový stav. Žádné jméno studenta ani ID třídy se neposílá.

## POST `/api/v1/sortio/polls`
Vytvoří anonymní hlasování. Tělo:

```json
{
  "schema": "sortio-live-poll-v1",
  "question": "Která možnost je správně?",
  "options": [{"id":"poll-option-...","label":"A"}],
  "anonymous": true,
  "expiresInMinutes": 60,
  "voterPath": "/apps/sortio/poll/"
}
```

Odpověď:

```json
{
  "id": "unguessable-public-id",
  "teacherToken": "unguessable-teacher-token",
  "voteUrl": "https://school.example/apps/sortio/poll/?id=...",
  "qrUrl": "https://school.example/api/v1/sortio/polls/.../qr.svg?token=..."
}
```

## GET `/api/v1/sortio/polls/{id}`
Veřejná anonymní metadata pro hlasujícího: `question`, `options`, `status`, `expiresAt`.

## POST `/api/v1/sortio/polls/{id}/votes`
Tělo `{ "optionId": "..." }`. Server má omezit opakované hlasování přiměřeně cíli (např. krátkodobý anonymní browser token/cookie + rate limit); nesmí vyžadovat identitu studenta.

## GET `/api/v1/sortio/polls/{id}/results?token={teacherToken}`
Odpověď `{ "status":"open", "options":[{"id":"...","votes":12}] }`. Učitelský panel ji načítá přibližně každých 1,8 s.

## POST `/api/v1/sortio/polls/{id}/close?token={teacherToken}`
Ukončí hlasování a odmítne další hlasy. Endpoint nevrací žádná osobní data; stačí `{ "status":"closed" }`.

## POST `/api/v1/sortio/qr`
Obecný QR generátor. Tělo `{ "schema":"sortio-qr-v1", "url":"https://...", "label":"..." }`; odpověď `{ "qrUrl":"same-origin URL na SVG/PNG" }`.

## Bezpečnostní požadavky
- kryptograficky náhodné veřejné ID a samostatný učitelský token;
- automatická expirace (výchozí 60 min) a mazání krátkodobého poll stavu;
- žádná jména, e-maily, ID studentů ani ID tříd;
- rate limiting a omezení velikosti otázky/možností;
- server vrací QR obrázek jen ze stejného originu;
- výsledkový endpoint je chráněn učitelským tokenem/session;
- public vote endpoint nepřijímá libovolné cílové URL ani HTML.
