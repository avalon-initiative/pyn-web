export const TOKEN_PERMISSIONS = [
  'read',
  'lock',
  'checkin',
  'restore',
  'force_unlock',
  'edit_policy',
  'manage_users',
  'manage_roles',
  'view_audit',
]

/** Splits `owner/name` entries separated by commas, spaces or newlines. */
export function parseRepos(text: string): string[] {
  return [...new Set(text.split(/[\s,]+/).filter(Boolean))]
}

/** A date input value (`YYYY-MM-DD`) as the end of that day in UTC, or null. */
export function expiryFromDate(date: string): string | null {
  return date ? `${date}T23:59:59Z` : null
}
