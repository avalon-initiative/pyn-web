import { fileBody, readmeEntry, VIEW_LIMIT } from '@avalon-initiative/pyn-common-ui'
import type {
  FetchedContent,
  ReadmeDoc,
  RepoInfo,
  TreeEntry,
} from '@avalon-initiative/pyn-common-ui'

type Repo = { owner: string; name: string }

export interface ReadmeReaders {
  tree: (r: Repo) => Promise<{ entries: TreeEntry[] }>
  content: (r: Repo, path: string, limit: number) => Promise<FetchedContent>
}

/** The repository named like the account is its profile repository. */
export const profileRepo = (account: string, repos: RepoInfo[]) =>
  repos.find((r) => r.owner === account && r.name === account) ?? null

/** The profile repository's README as text, or null when there is none or it is not text. */
export async function loadProfileReadme(
  account: string,
  repos: RepoInfo[],
  read: ReadmeReaders,
): Promise<ReadmeDoc | null> {
  const repo = profileRepo(account, repos)
  if (!repo) return null
  try {
    const found = readmeEntry((await read.tree(repo)).entries)
    if (!found) return null
    const body = fileBody(found.path, await read.content(repo, found.path, VIEW_LIMIT))
    return body.kind === 'markdown' || body.kind === 'code'
      ? { name: found.name, path: found.path, text: body.text }
      : null
  } catch {
    return null
  }
}

/** People-directory rows for the organization home from its member list. */
export function peopleOf(
  members: { user: string; identity?: { user: string } | null }[],
): { identity: { user: string } }[] {
  return members.map((m) => ({ identity: m.identity ?? { user: m.user } }))
}
