import type { AccessCheckItem } from '@avalon-initiative/pyn-common-ui'
import type { RegistrationInfo } from '../types/auth.types'
import type { ServerSetup } from '../types/admin.types'

/** Checklist facts for going public, from what the server reports; the rest is guidance. */
export function accessChecklist(
  setup: Pick<ServerSetup, 'public_url' | 'registration'>,
  reg: RegistrationInfo | null,
): AccessCheckItem[] {
  const url = setup.public_url.trim()
  const https = url.startsWith('https://')
  const open = setup.registration === 'open'
  const protectedSignUp = !open || !!reg?.email_verification || !!reg?.approval
  return [
    {
      id: 'address',
      label: 'Public address and HTTPS',
      status: https ? 'ok' : 'todo',
      detail: url ? (https ? url : `${url} is not an https address.`) : 'No public address is set.',
    },
    {
      id: 'registration',
      label: 'Registration mode and sign-up protections',
      status: protectedSignUp ? 'ok' : 'todo',
      detail: open
        ? protectedSignUp
          ? 'Registration is open with email verification or approval.'
          : 'Registration is open without email verification or approval.'
        : `Registration is ${setup.registration}.`,
    },
    {
      id: 'limits',
      label: 'Rate limits',
      status: 'unknown',
      detail:
        'Signed-out requests are rate limited by the server; the limits are set in its environment.',
    },
  ]
}
