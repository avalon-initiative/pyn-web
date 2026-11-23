import { ref } from 'vue'
import type { NavigationGuard } from 'vue-router'

/** True while an administrator's one-time password is still the account's password. */
export const passwordChangeRequired = ref(false)

export const PASSWORD_CHANGE_REASON =
  'An administrator set a one-time password for this account. Choose your own password now to continue.'

/** The server does not enforce the change, so every other page sends the person here until it is done. */
export const passwordChangeGuard: NavigationGuard = (to) =>
  passwordChangeRequired.value && to.name !== 'password' ? { name: 'password' } : true
