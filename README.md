# pyn-web

Web UI for pyn. See `CLAUDE.md` for structure and rules. `npm run storybook` to browse the components; `npm run dev`
(with the pyn server running) for the app.

## Routes

| Route                                                                | Page                                                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `/`                                                                  | repositories you belong to, with your role                                                    |
| `/_/new`                                                             | create a repository (owned by the signed-in account)                                          |
| `/_/keys`                                                            | SSH keys (account pages live under `/_/`, which no user name can take)                        |
| `/:owner/:name`                                                      | files and lock state                                                                          |
| `/:owner/:name/{locks,history,audit,members,roles,invites,settings}` | repository pages; tabs follow the caller's permissions from `GET /v1/repos/{owner}/{name}/me` |

An account with no role in a repository, or any outsider to a private one, sees "Repository not found". Local sign-in needs the
server started with `PYN_BOOTSTRAP_ADMIN` and `PYN_BOOTSTRAP_PASSWORD`; the dev server proxies `/v1` to it.
