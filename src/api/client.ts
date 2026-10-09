import { formatWait } from '../state/wait.state'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message)
  }
}

const FRIENDLY: Record<string, string> = {
  repo_not_found: 'That repository does not exist, or you have no role in it.',
  repo_exists: 'A repository with that name already exists for this owner.',
  invalid_repo_name:
    'Use 1 to 100 lowercase letters, digits, "-", "_" or ".", starting with a letter or digit and not ending in ".".',
  path_not_found: 'That folder does not exist in this repository.',
  not_namespace_owner: 'Only the repository owner, as an admin, can do that.',
  invalid_verification: 'This verification link is not valid. It may be used already or expired.',
  server_admin_required: 'Only a server administrator can do that.',
  user_not_found: 'That account does not exist.',
  user_exists: 'That name is already taken by a user or an organization.',
  reserved_name: 'That name is reserved. Choose another.',
  org_not_found: 'That organization does not exist.',
  not_org_owner: 'Only an owner of the organization can do that.',
  not_org_member: 'Only a member of the organization can do that.',
  org_not_empty: 'Delete the repositories the organization owns first.',
  user_not_org_member: 'That user is not a member of the organization.',
  already_org_member: 'That account is already a member of the organization.',
  org_member_not_found: 'That account is not a member of the organization.',
  team_exists: 'A team with that name already exists in the organization.',
  team_not_found: 'That team does not exist.',
  team_member_not_found: 'That user is not in the team.',
  not_org_repo: 'Only repositories owned by an organization can grant roles to teams.',
  creation_rule_not_found: 'That rule does not exist.',
  last_org_owner: 'An organization needs at least one owner. Make someone else an owner first.',
}

export function describeError(e: unknown): string {
  if (e instanceof ApiError && e.code === 'too_many_attempts')
    return `Too many attempts. Try again in ${formatWait(e.retryAfter)}.`
  if (e instanceof ApiError) return FRIENDLY[e.code] ?? e.message
  return `Could not reach pyn-server: ${e instanceof Error ? e.message : String(e)}`
}
