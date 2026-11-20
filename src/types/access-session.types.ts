import type {
  AccessSessionInfo,
  AccessSessionReason,
  AccessSessionState,
} from '@avalon-initiative/pyn-common-ui'
import type { Schemas } from '../api/schema'

const REASONS: AccessSessionReason[] = [
  'abuse_report',
  'security_incident',
  'support_request',
  'legal_request',
  'other',
]
const STATES: AccessSessionState[] = ['active', 'ended', 'expired']

/** The wire session with `reason` and `state` narrowed to the library's unions; unknown values degrade to `other` and `ended`. */
export function toAccessSession(s: Schemas['AccessSessionInfo']): AccessSessionInfo {
  return {
    ...s,
    reason: REASONS.includes(s.reason) ? s.reason : 'other',
    state: STATES.includes(s.state as AccessSessionState)
      ? (s.state as AccessSessionState)
      : 'ended',
  }
}
