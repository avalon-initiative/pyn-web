import { ref } from 'vue'
import { ApiError, describeError } from '../api/client'
import { NAME_RULES } from '../types/name.types'

const TYPED = /^[A-Za-z0-9 _-]+$/
const CANONICAL = /^[a-z0-9_-]{2,39}$/

/** The URL form of an owner name: trimmed, whitespace runs as "-", ASCII lowercase. */
export const canonicalName = (name: string): string =>
  name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[A-Z]/g, (c) => c.toLowerCase())

/** The format problem with a typed owner name, or '' when it passes (reserved words are the server's call). */
export function nameProblem(name: string): string {
  const ok = TYPED.test(name.trim()) && CANONICAL.test(canonicalName(name))
  return ok ? '' : `"${name}" is not a valid name. ${NAME_RULES}`
}

/** The live name check for a form's `nameInput` event; blank shows nothing until submitted. */
export function useNameCheck() {
  const nameMessage = ref('')
  const nameCanonical = ref('')
  const checkName = (name: string) => {
    nameMessage.value = name.trim() ? nameProblem(name) : ''
    nameCanonical.value = name.trim() && !nameMessage.value ? canonicalName(name) : ''
  }
  return { nameMessage, nameCanonical, checkName }
}

/** Words `user_exists` against the canonical name that was sent; other errors as usual. */
export function describeNameError(e: unknown, name: string): string {
  if (e instanceof ApiError && e.code === 'user_exists' && name)
    return `"${name}" is already taken by a user or an organization.`
  return describeError(e)
}

/** Words `repo_exists` against the canonical name that was sent: names match ignoring case and spaces become hyphens. */
export function describeRepoNameError(e: unknown, owner: string, name: string): string {
  if (e instanceof ApiError && e.code === 'repo_exists' && name)
    return `"${owner}/${name}" already exists. Repository names are not case sensitive, and spaces count as hyphens, so "Test Repo" and "test-repo" are the same.`
  return describeError(e)
}
