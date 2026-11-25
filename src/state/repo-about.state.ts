import type { RepoDetails, UpdateRepoRequest } from '../types/repo.types'

export const DESCRIPTION_MAX = 350
export const TOPICS_MAX = 20
const TOPIC = /^[a-z0-9-]{1,50}$/

/** Splits on commas and whitespace, lowercases and drops repeats; `error` names the first rule broken. */
export function parseTopics(text: string): { topics: string[]; error: string } {
  const topics = [
    ...new Set(
      text
        .split(/[\s,]+/)
        .map((t) => t.toLowerCase())
        .filter(Boolean),
    ),
  ]
  const bad = topics.find((t) => !TOPIC.test(t))
  if (bad) return { topics, error: `"${bad}" is not a topic: use 1 to 50 of a-z, 0-9 and -.` }
  if (topics.length > TOPICS_MAX) return { topics, error: `At most ${TOPICS_MAX} topics.` }
  return { topics, error: '' }
}

export interface AboutFields {
  description: string
  website: string
  topics: string
}

export const aboutFields = (r: RepoDetails): AboutFields => ({
  description: r.description ?? '',
  website: r.website ?? '',
  topics: (r.topics ?? []).join(', '),
})

/** The PATCH body for the About fields; blank clears. */
export const aboutRequest = (f: AboutFields, topics: string[]): UpdateRepoRequest => ({
  description: f.description.trim() || null,
  website: f.website.trim() || null,
  topics,
})

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
