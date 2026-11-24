import type { RepoShellTab } from '@avalon-initiative/pyn-common-ui'

/** Adds Pull requests after Code, Branches before History and Policy after it; all need only read access. */
export function withPolicyTabs(tabs: RepoShellTab[]): RepoShellTab[] {
  const out: RepoShellTab[] = []
  for (const tab of tabs) {
    if (tab.section === 'history') out.push({ section: 'branches', label: 'Branches' })
    out.push(tab)
    if (tab.section === '')
      out.push({ section: 'pulls', label: 'Pull requests', icon: 'pull-request' })
    if (tab.section === 'history') out.push({ section: 'policy', label: 'Policy' })
  }
  return out
}
