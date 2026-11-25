import type { RepoDetails, UpdateRepoRequest } from '../types/repo.types'

export const DESCRIPTION_MAX = 350

export interface AboutFields {
  description: string
  website: string
  topics: string[]
}

export const aboutFields = (r: RepoDetails): AboutFields => ({
  description: r.description ?? '',
  website: r.website ?? '',
  topics: [...(r.topics ?? [])],
})

/** The PATCH body for the About fields; blank clears. */
export const aboutRequest = (f: AboutFields): UpdateRepoRequest => ({
  description: f.description.trim() || null,
  website: f.website.trim() || null,
  topics: f.topics,
})

export const aboutChanged = (f: AboutFields, r: RepoDetails) =>
  JSON.stringify(f) !== JSON.stringify(aboutFields(r))

/** Language names across repositories, by total bytes, largest first. */
export function topLanguages(repos: RepoDetails[], max = 5): string[] {
  const bytes = new Map<string, number>()
  for (const r of repos)
    for (const l of r.languages ?? []) bytes.set(l.name, (bytes.get(l.name) ?? 0) + l.bytes)
  return [...bytes]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([name]) => name)
}

/** Topics across repositories, most used first. */
export function topTopics(repos: RepoDetails[], max = 10): string[] {
  const uses = new Map<string, number>()
  for (const r of repos) for (const t of r.topics ?? []) uses.set(t, (uses.get(t) ?? 0) + 1)
  return [...uses]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([name]) => name)
}
