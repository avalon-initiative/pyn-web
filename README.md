# pyn-web

The web UI for [pyn](https://github.com/avalon-initiative/pyn), version control that merges what can be merged and
locks what shouldn't be. It shows a repository's files with each path's mode (`shared` or `exclusive`) and lock holder,
and covers the day-to-day work around them: locks, history, the audit log, members, roles, invitations, organizations
and teams, and account settings (SSH keys, API tokens, linked identities). Vue 3, Vite and TypeScript.

The server is the only authority: this app is a client of its API and enforces nothing itself.

## Run it

Start a pyn server first (`make dev` in the `pyn` repo brings one up with a seeded demo), then:

```bash
export NODE_AUTH_TOKEN=$(gh auth token)   # needs read:packages; see .npmrc
npm ci
npm run dev        # http://localhost:5173, sign in as alice or bob (alice-password, bob-password)
```

The dev server proxies `/v1` to `http://127.0.0.1:7878`, or to `PYN_API` if set. On a server that is not set up yet the
app shows only the setup wizard, which needs the setup token from the server's log (or `PYN_SETUP_TOKEN`).

## Scripts

| Command                                                                 | What it does                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                                                           | Dev server                                                         |
| `npm run build`                                                         | Production build into `dist/`                                      |
| `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` | Checks run in CI                                                   |
| `npm run api:generate`                                                  | Regenerate the API client types from the server's OpenAPI document |
| `npm run api:check`                                                     | Fail when the generated types are out of date                      |

## API client

`src/api/schema.gen.ts` is generated from the server's OpenAPI document (`pyn/docs/generated/openapi.json`) and typed
calls go through `openapi-fetch` in `src/api/http.ts`. Set `PYN_OPENAPI` to a path or URL if the pyn checkout is not a
sibling directory.

## Routes

| Route                                                                | Page                                                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `/`                                                                  | repositories you belong to, with your role                                                          |
| `/verify-email`                                                      | email verification landing page                                                                     |
| `/_/orgs`                                                            | organizations you belong to                                                                         |
| `/_/new`, `/_/new-org`                                               | create a repository or an organization                                                              |
| `/_/locks`                                                           | locks you hold, across repositories                                                                 |
| `/_/settings/{keys,tokens,identities}`                               | account settings (`/_/keys` and `/_/tokens` also work)                                              |
| `/_/admin/accounts`                                                  | server administration of accounts                                                                   |
| `/:owner`                                                            | an owner's repositories; `/:owner/-/{members,teams,teams/:team,audit,settings}` for an organization |
| `/:owner/:name`                                                      | files and lock state; `tree/<path>` for a folder, `blob/<path>` for a file                          |
| `/:owner/:name/{locks,history,audit,members,roles,invites,settings}` | repository pages; tabs follow the caller's permissions from `GET /v1/repos/{owner}/{name}/me`       |

An account with no role in a repository, or any outsider to a private one, sees "Repository not found".

## License

Apache-2.0.

## Support the project

<a href="https://www.buymeacoffee.com/lunarvagabond" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-blue.png" alt="Buy Me a Coffee" style="height: 60px !important;width: 217px !important;" ></a>
