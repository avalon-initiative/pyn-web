import { formatWait } from '@avalon-initiative/pyn-common-ui'
import { reservedMessage } from '../types/name.types'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfter?: number,
    readonly blockers?: { repos: string[]; orgs: string[] },
  ) {
    super(message)
  }
}

const PASSKEY_GENERIC = 'The passkey could not be verified. Try again, or use another passkey.'
const PASSKEY_NOT_REGISTERED =
  'This passkey is not registered here, or it was registered before a fix; remove it and add it again.'
const PASSKEY_ADDRESS = "The address in the browser does not match the server's public address."

const FRIENDLY: Record<string, string> = {
  repo_not_found: 'That repository does not exist, or you have no role in it.',
  repo_exists: 'A repository with that name already exists for this owner.',
  invalid_repo_name:
    'Use 1 to 100 letters, digits, "-", "_" or ".", starting with a letter or digit and not ending in ".".',
  path_not_found: 'That folder does not exist in this repository.',
  not_namespace_owner: 'Only the repository owner, as an admin, can do that.',
  invalid_verification: 'This verification link is not valid. It may be used already or expired.',
  server_admin_required: 'Only a server administrator can do that.',
  account_owns_resources:
    'Transfer or delete the repositories and organizations this account owns first.',
  user_not_found: 'That account does not exist.',
  user_exists: 'That name is already taken by a user or an organization.',
  invalid_invite: 'That invitation code is not valid: it may be used, revoked or expired.',
  server_invitation_not_found:
    'That invitation no longer exists. Reload the list to see where it stands.',
  email_already_confirmed: 'That account has already confirmed its email address.',
  email_verification_off:
    'This server does not verify email addresses, so there is no confirmation to resend.',
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
  owner_frozen:
    'This account is frozen: it can be viewed but not changed. Contact a server administrator.',
  repo_storage_limit_reached:
    'This repository reached its storage cap. Free up space, or ask an administrator to raise the cap.',
  already_invited: 'That account already has a pending invitation to the organization.',
  org_invitation_not_found:
    'That invitation is no longer pending. It may have been cancelled or expired.',
  member_limit_reached:
    'The organization has reached its member limit. The invitation stays; try again once there is room.',
  second_factor_invalid: 'That code is not right, or it was already used. Try the next one.',
  passkey_invalid: PASSKEY_GENERIC,
  passkey_ceremony_expired: 'The sign-in took too long. Try again.',
  passkey_not_registered: PASSKEY_NOT_REGISTERED,
  passkey_user_handle_mismatch: PASSKEY_NOT_REGISTERED,
  passkey_origin_not_allowed: PASSKEY_ADDRESS,
  passkey_rp_id_mismatch: PASSKEY_ADDRESS,
  passkey_user_verification_required: 'Your device must verify you (PIN or biometrics).',
  passkey_counter_regressed: 'This passkey may have been copied; it was refused.',
  passkey_challenge_mismatch: PASSKEY_GENERIC,
  passkey_signature_invalid: PASSKEY_GENERIC,
  passkey_replayed: PASSKEY_GENERIC,
  passkey_already_registered: PASSKEY_GENERIC,
  passkey_not_found: 'That passkey no longer exists.',
  factor_not_found: 'That second factor no longer exists.',
  passkeys_unavailable:
    'This server cannot use passkeys: it has no public address WebAuthn accepts.',
  fresh_check_required: 'Confirm with a second factor first, then try again.',
  two_factor_enrolment_required:
    'Set up a second factor under Account settings, Security, before doing anything else.',
  access_session_not_allowed:
    'An access session cannot do that: this route is not open to administrators acting as an account.',
  access_session_not_found: 'That access session does not exist.',
  account_inactive: 'That account is not active, so no access session can start on it.',
  last_org_owner: 'An organization needs at least one owner. Make someone else an owner first.',
}

/** The server words it `"admin" is reserved and ...`; falls back to a generic subject. */
function reservedName(e: ApiError): string {
  const name = /^"(.*)" is reserved/.exec(e.message)?.[1]
  return reservedMessage(name === undefined ? 'That name' : `"${name}"`)
}

export function describeError(e: unknown): string {
  if (e instanceof ApiError && e.code === 'too_many_attempts')
    return `Too many attempts. Try again in ${formatWait(e.retryAfter)}.`
  if (e instanceof ApiError && e.code === 'reserved_name') return reservedName(e)
  if (e instanceof ApiError) return FRIENDLY[e.code] ?? e.message
  return `Could not reach pyn-server: ${e instanceof Error ? e.message : String(e)}`
}
