# Extending the app at build time

A separately built application can add routes, side-nav entries and account-menu entries to the standard app. There is
no runtime loading: nothing is fetched from an address, and the extras are compiled into the consumer's own web build
(decision pyn#816). With nothing registered the app is exactly the standard one.

## Entry point

```ts
import { createPynApp, EXTENSION_PREFIX } from 'pyn-web'
import '@avalon-initiative/pyn-common-ui/tokens.css'
import '@avalon-initiative/pyn-common-ui/global.css'
import '@avalon-initiative/pyn-common-ui/style.css'

createPynApp({
  routes: [{ path: `${EXTENSION_PREFIX}/reports`, name: 'reports', component: ReportsView }],
  navItems: [
    { id: 'reports', label: 'Reports', href: `${EXTENSION_PREFIX}/reports`, icon: 'settings' },
  ],
  accountMenuItems: [
    { id: 'usage', label: 'Usage report', href: `${EXTENSION_PREFIX}/usage` },
    { id: 'help', label: 'Get help', onSelect: () => openHelp() },
  ],
}).mount('#app')
```

`createPynApp(extension?, history?)` returns the Vue app, not yet mounted. `src/main.ts` calls it with nothing.

## Entry shapes

| Field              | Type                | Notes                                                                                                                                    |
| ------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `routes`           | `RouteRecordRaw[]`  | Top-level records. `path` must be `EXTENSION_PREFIX` or below it; no `alias`.                                                            |
| `navItems`         | `NavItem[]`         | `{ id, label, href, icon? }`, listed after the built-in entries. The entry is marked current on `href` and below it.                     |
| `accountMenuItems` | `AccountMenuItem[]` | `MenuItem` plus `onSelect`. With `href` the item is a link; without it a button that runs `onSelect`. Listed after the built-in entries. |

`createPynApp` throws, naming the entry, when a route is outside the prefix, declares an alias or reuses a built-in
route name, when an entry id is already taken, or when an `href` is not an internal path.

## Reserved prefix

Extra routes live under `/_/x`. A user, organization or repository name must match `[a-z0-9_-]{2,39}`, so `_` can never
be an owner: everything under `/_/` is outside `/:owner/:name`, the same convention the account pages use. `x` is
reserved for extensions; a built-in page never takes it.

## What a page can use

Pages render inside the shell, so they get the sidebar, top bar and theme for free. A page reaches:

- the session: `inject(sessionKey)` gives `{ user, admin, expire }` (refs; call `expire()` when the server answers 401);
- the API: `api` (typed `openapi-fetch` client, adds the CSRF header) and `call(request)` (unwraps the body and throws
  `ApiError`); `describeError(e)` turns an error into text.

All are exported from the package root. The server stays the only authority: a page decides what to show, and the server
re-checks every request ([trust-boundary.md](trust-boundary.md)).

## Consuming it

The package is not built to a bundle; the root export (`exports["."]`) points at `src/index.ts`, so the consumer's Vite
build with `@vitejs/plugin-vue` compiles `pyn-web` from source together with its own code. The consumer must resolve a
single copy of `vue` and `vue-router` (`resolve.dedupe`), and imports the library CSS itself, as `src/main.ts` does.
Presentation still belongs in `pyn-common-ui`: extra pages use its components and tokens.
