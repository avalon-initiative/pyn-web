# Trust boundary

The browser is an untrusted client. pyn-web decides what to show from server answers and enforces nothing; the server
re-checks every request. `tests/trust-boundary.test.ts` and `scripts/check_public_boundary.py` hold this in place.

## What the client sends

- The session cookie (`HttpOnly`, set by the server, unreadable to the page).
- The `X-Pyn-CSRF` header on state-changing requests, with the token from `POST`/`GET /v1/session` only.
- The arguments of the action the person took (a path, a reason, a name, a role being granted to someone else).

It never sends its own user name, role, permission, admin flag or entitlement as a claim; identity comes from the cookie.

## What drives the UI

- Who is signed in and whether they administer the server: `GET /v1/session`, `GET /v1/me`.
- What they may do in a repository: `GET /v1/repos/{owner}/{name}/me`.

A control hidden or shown from these is a convenience. When the server refuses an action anyway (403, 404, a limit or
freeze code), the refusal is shown as the error.

## What forking or editing the app can change

Only presentation and which requests are attempted. A modified client gains nothing: it holds no secret, its session
cookie and CSRF token are the user's own, and the server decides every request from the session and the repository's
policy. Nothing the server trusts is stored in the browser.

## Hosted-service concepts

Plans, billing, entitlements and payments do not exist in this repository. The public-boundary check fails on those
terms in source and configuration.
