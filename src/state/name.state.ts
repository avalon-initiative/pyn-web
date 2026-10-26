import { ref } from 'vue'
import { NAME_RULES } from '../types/name.types'

const NAME_FORMAT = /^[a-z0-9_-]{2,39}$/

/** The format problem with a user or organization name, or '' when it passes (reserved words are the server's call). */
export function nameProblem(name: string): string {
  return NAME_FORMAT.test(name) ? '' : `"${name}" is not a valid name. ${NAME_RULES}`
}

/** The live name check for a form's `nameInput` event; blank shows nothing until submitted. */
export function useNameCheck() {
  const nameMessage = ref('')
  const checkName = (name: string) => {
    nameMessage.value = name ? nameProblem(name) : ''
  }
  return { nameMessage, checkName }
}
