import { onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'
import { repoPath } from '@avalon-initiative/pyn-common-ui'
import type { OrgInfo, RepoInfo, SearchResult } from '@avalon-initiative/pyn-common-ui'
import { listPeople } from '../api/people'
import { PEOPLE_SEARCH_MAX } from './people.state'

export const SEARCH_RESULTS_MAX = 5
const PEOPLE_DELAY_MS = 250

export interface FoundPerson {
  user: string
  displayName?: string | null
  avatarUrl?: string | null
}

/** Owners (organizations, then people) and repositories matching the text, each group capped. */
export function topBarSearchResults(
  text: string,
  repos: RepoInfo[],
  orgs: OrgInfo[],
  people: FoundPerson[],
): SearchResult[] {
  const q = text.trim().toLowerCase()
  if (!q) return []
  const owners: SearchResult[] = []
  for (const o of orgs) {
    if (o.name.toLowerCase().includes(q))
      owners.push({ id: `owner:${o.name}`, kind: 'owner', label: o.name, href: `/${o.name}` })
  }
  for (const p of people) {
    if (owners.some((r) => r.id === `owner:${p.user}`)) continue
    owners.push({
      id: `owner:${p.user}`,
      kind: 'owner',
      label: p.user,
      href: `/${p.user}`,
      hint: p.displayName ?? undefined,
      avatarUrl: p.avatarUrl,
    })
  }
  const found = repos
    .filter((r) => `${r.owner}/${r.name}`.toLowerCase().includes(q))
    .map((r): SearchResult => ({
      id: `repo:${r.owner}/${r.name}`,
      kind: 'repository',
      label: `${r.owner}/${r.name}`,
      href: repoPath(r),
    }))
  return [...owners.slice(0, SEARCH_RESULTS_MAX), ...found.slice(0, SEARCH_RESULTS_MAX)]
}

/** Results for the top bar search: local ones at once, then people from the server. */
export function useTopBarSearch(repos: Ref<RepoInfo[]>, orgs: Ref<OrgInfo[]>) {
  const results = ref<SearchResult[]>([])
  let timer: ReturnType<typeof setTimeout> | undefined
  let seq = 0

  function input(value: string) {
    clearTimeout(timer)
    const mine = ++seq
    const q = value.trim().slice(0, PEOPLE_SEARCH_MAX)
    results.value = topBarSearchResults(q, repos.value, orgs.value, [])
    if (!q) return
    timer = setTimeout(async () => {
      try {
        const page = await listPeople({ q, limit: SEARCH_RESULTS_MAX })
        if (mine !== seq) return
        results.value = topBarSearchResults(
          q,
          repos.value,
          orgs.value,
          page.people.map((p) => ({
            user: p.identity.user,
            displayName: p.identity.display_name,
            avatarUrl: p.identity.avatar_url,
          })),
        )
      } catch {
        // the local results stay
      }
    }, PEOPLE_DELAY_MS)
  }

  onUnmounted(() => clearTimeout(timer))
  return { results, input }
}
