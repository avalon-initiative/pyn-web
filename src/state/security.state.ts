import { ref } from 'vue'
import type { TotpEnrolment } from '@avalon-initiative/pyn-common-ui'
import {
  beginPasskeyRegistration,
  beginTotp,
  confirmTotp,
  dismissNotice,
  fetchTwoFactor,
  finishPasskeyRegistration,
  listNotices,
  regenerateRecoveryCodes,
  removeFactor,
  removePasskey,
  renamePasskey,
} from '../api/two-factor'
import type { Notice, TwoFactorStatus } from '../types/two-factor.types'
import { fetchMe } from '../api/admin'
import { useAction } from './action.state'
import { twoFactorDue } from './two-factor.state'
import { createPasskey, passkeyBrowserError, passkeysSupported } from './webauthn.state'

/** The account's second-factor state and the actions that change it. */
export function useSecurity() {
  const status = ref<TwoFactorStatus | null>(null)
  const notices = ref<Notice[]>([])
  const enrolment = ref<TotpEnrolment | null>(null)
  const codes = ref<string[] | null>(null)
  const { busy, error, attempt } = useAction(false)
  const hasPassword = ref(true)
  const askPassword = ref(false)

  async function refresh() {
    status.value = await fetchTwoFactor()
    twoFactorDue.value = status.value.required ?? null
  }

  const load = () =>
    attempt(async () => {
      await refresh()
      notices.value = await listNotices().catch(() => [])
      hasPassword.value = (await fetchMe().catch(() => null))?.has_password !== false
    })

  /** Keeps the one-time recovery codes the server sent with an account's first factor. */
  function keepCodes(fresh?: string[] | null) {
    if (fresh?.length) codes.value = fresh
  }

  const startTotp = (label = '', password?: string) =>
    attempt(async () => {
      enrolment.value = await beginTotp(label, password)
    })

  const confirm = (code: string) =>
    attempt(async () => {
      if (!enrolment.value) return
      keepCodes((await confirmTotp(enrolment.value.id, code)).recovery_codes)
      enrolment.value = null
      await refresh()
    })

  const cancelTotp = () =>
    attempt(async () => {
      const pending = enrolment.value
      enrolment.value = null
      if (pending) await removeFactor(pending.id).catch(() => undefined)
    })

  const removeTotp = (id: string) =>
    attempt(async () => {
      await removeFactor(id)
      await refresh()
    })

  const regenerate = () =>
    attempt(async () => {
      codes.value = await regenerateRecoveryCodes()
      await refresh()
    })

  /** Registers a passkey; an account with a password but no factor yet is asked for it first. */
  async function addPasskey(password?: string) {
    if (password === undefined && hasPassword.value && !status.value?.enabled) {
      askPassword.value = true
      return
    }
    if (await registerPasskey(password)) askPassword.value = false
  }

  const registerPasskey = (password?: string) =>
    attempt(async () => {
      try {
        const begun = await beginPasskeyRegistration(password)
        const credential = await createPasskey(begun.public_key)
        keepCodes((await finishPasskeyRegistration(begun.ceremony, credential)).recovery_codes)
      } catch (e) {
        const text = passkeyBrowserError(e)
        if (!text) throw e
        error.value = text
        return
      }
      await refresh()
    })

  const rename = (id: string, name: string) =>
    attempt(async () => {
      await renamePasskey(id, name)
      await refresh()
    })

  const removeKey = (id: string) =>
    attempt(async () => {
      await removePasskey(id)
      await refresh()
    })

  const dismiss = (id: string) =>
    attempt(async () => {
      await dismissNotice(id)
      notices.value = notices.value.filter((n) => n.id !== id)
    })

  return {
    status,
    notices,
    enrolment,
    codes,
    hasPassword,
    askPassword,
    busy,
    error,
    passkeysOffered: () => !!status.value?.passkeys_available && passkeysSupported(),
    load,
    startTotp,
    confirm,
    cancelTotp,
    removeTotp,
    regenerate,
    addPasskey,
    rename,
    removeKey,
    dismiss,
    cancelPassword: () => ((askPassword.value = false), (error.value = '')),
    acknowledgeCodes: () => (codes.value = null),
  }
}
