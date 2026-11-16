export const PENDING_DELETION = 'account_pending_deletion'

let listener: (() => void) | null = null

/** Registers the one reaction to the server refusing a call for a pending-deletion account. */
export function onPendingDeletion(fn: (() => void) | null) {
  listener = fn
}

export function reportPendingDeletion(code: string) {
  if (code === PENDING_DELETION) listener?.()
}
