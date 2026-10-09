export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

const FRIENDLY: Record<string, string> = {
  repo_not_found: 'That repository does not exist, or you have no role in it.',
  repo_exists: 'A repository with that name already exists for this owner.',
  invalid_repo_name:
    'Use 1 to 100 lowercase letters, digits, "-", "_" or ".", starting with a letter or digit and not ending in ".".',
  not_namespace_owner: 'Only the repository owner, as an admin, can do that.',
}

export function describeError(e: unknown): string {
  if (e instanceof ApiError) return FRIENDLY[e.code] ?? e.message
  return `Could not reach pyn-server: ${e instanceof Error ? e.message : String(e)}`
}
