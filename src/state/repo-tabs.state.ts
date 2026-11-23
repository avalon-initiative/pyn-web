import type { RepoShellTab } from '@avalon-initiative/pyn-common-ui'

/** Adds Branches before History and Policy after it; both pages need only read access. */
export function withPolicyTabs(tabs: RepoShellTab[]): RepoShellTab[] {
  const out: RepoShellTab[] = []
  for (const tab of tabs) {
    if (tab.section === 'history') out.push({ section: 'branches', label: 'Branches' })
    out.push(tab)
    if (tab.section === 'history') out.push({ section: 'policy', label: 'Policy' })
  }
  return out
}
