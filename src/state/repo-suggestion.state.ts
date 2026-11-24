const ADJECTIVES = ['bright', 'quiet', 'swift', 'amber', 'clever', 'steady', 'lucky', 'tidy']
const NOUNS = ['harbor', 'forge', 'meadow', 'lantern', 'atlas', 'ledger', 'summit', 'orchard']

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)]

/** A short two-word name offered under the repository name field. */
export const suggestRepoName = () => `${pick(ADJECTIVES)}-${pick(NOUNS)}`
