import type { BranchOption, BranchSummary, LockInfo } from '@avalon-initiative/pyn-common-ui'

const RAIL_BRANCHES = 5

/** Distinct lock holders, in the order their locks are listed. */
export function lockHolders(locks: LockInfo[]): string[] {
  return [...new Set(locks.map((l) => l.owner))]
}

/** The newest branches first; ahead and behind are known only for the compared one. */
export function railBranches(
  options: BranchOption[],
  compared?: { head: string; ahead: number; behind: number } | null,
): BranchSummary[] {
  return [...options]
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    .slice(0, RAIL_BRANCHES)
    .map((o) => ({
      name: o.name,
      isDefault: o.isDefault,
      updatedAt: o.updatedAt,
      ...(compared && compared.head === o.name
        ? { ahead: compared.ahead, behind: compared.behind }
        : {}),
    }))
}
