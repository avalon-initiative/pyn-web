# pyn-web

Web UI for pyn. See `CLAUDE.md` for structure and rules. `npm run storybook` to browse the components; `npm run dev`
(with the pyn server running) for the app.

## API client

`src/api/schema.gen.ts` is generated from the server's OpenAPI document (`pyn/docs/generated/openapi.json`) and typed
calls go through `openapi-fetch` in `src/api/http.ts`. Regenerate with `npm run api:generate`; set `PYN_OPENAPI` to a
path or URL if the pyn checkout is not a sibling directory. `npm run api:check` fails when the file is out of date.

## Routes

| Route                                                                | Page                                                                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/`                                                                  | repositories you belong to, with your role                                                               |
| `/_/new`                                                             | create a repository (owned by the signed-in account)                                                     |
| `/_/settings`                                                        | account settings; `/_/settings/keys` (also `/_/keys`) lists SSH keys, `/_/settings/tokens` access tokens |
| `/:owner/:name`                                                      | files and lock state                                                                                     |
| `/:owner/:name/{locks,history,audit,members,roles,invites,settings}` | repository pages; tabs follow the caller's permissions from `GET /v1/repos/{owner}/{name}/me`            |

An account with no role in a repository, or any outsider to a private one, sees "Repository not found". On a server that is not set up yet the app shows only the setup wizard; it needs the
setup token from the server's log (or `PYN_SETUP_TOKEN`). The dev server proxies `/v1` to the server.
