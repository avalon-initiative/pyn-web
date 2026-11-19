import type { Passkey, TotpEnrolment } from '@avalon-initiative/pyn-common-ui'
import type {
  FreshCheck,
  Notice,
  PasskeyCreation,
  PasskeyRegistered,
  PasskeyRequest,
  TotpConfirmed,
  TwoFactorStatus,
} from '../types/two-factor.types'
import type { Schemas } from './schema'
import { api, call } from './http'

const id = (v: string) => ({ params: { path: { id: v } } })

export const fetchTwoFactor = () => call<TwoFactorStatus>(api.GET('/v1/me/two-factor'))

export const beginTotp = (label: string, password?: string) =>
  call<TotpEnrolment>(
    api.POST('/v1/me/two-factor/totp', {
      body: { label: label.trim() || null, password: password ?? null },
    }),
  )

export const confirmTotp = (enrolment: string, code: string) =>
  call<TotpConfirmed>(
    api.POST('/v1/me/two-factor/totp/{id}/confirm', { ...id(enrolment), body: { code } }),
  )

export const removeFactor = (factor: string) =>
  call<void>(api.DELETE('/v1/me/two-factor/{id}', id(factor)))

export const regenerateRecoveryCodes = async () =>
  (await call<{ recovery_codes: string[] }>(api.POST('/v1/me/two-factor/recovery-codes')))
    .recovery_codes

/** The fresh check with an authenticator-app or recovery code. */
export const verifySecondFactor = (code: string) =>
  call<FreshCheck>(api.POST('/v1/me/two-factor/verify', { body: { code } }))

export const listPasskeys = () => call<Passkey[]>(api.GET('/v1/me/passkeys'))

export const beginPasskeyRegistration = (password?: string) =>
  call<PasskeyCreation>(
    api.POST('/v1/me/passkeys/register/begin', { body: { password: password ?? null } }),
  )

export const finishPasskeyRegistration = (
  ceremony: string,
  credential: Schemas['PasskeyAttestationCredential'],
  name?: string,
) =>
  call<PasskeyRegistered>(
    api.POST('/v1/me/passkeys/register/finish', {
      body: { ceremony, credential, name: name?.trim() || null },
    }),
  )

export const renamePasskey = (passkey: string, name: string) =>
  call<Passkey>(api.PATCH('/v1/me/passkeys/{id}', { ...id(passkey), body: { name } }))

export const removePasskey = (passkey: string) =>
  call<void>(api.DELETE('/v1/me/passkeys/{id}', id(passkey)))

export const beginPasskeyVerify = () =>
  call<PasskeyRequest>(api.POST('/v1/me/passkeys/verify/begin'))

export const finishPasskeyVerify = (
  ceremony: string,
  credential: Schemas['PasskeyAssertionCredential'],
) => call<FreshCheck>(api.POST('/v1/me/passkeys/verify/finish', { body: { ceremony, credential } }))

export const listNotices = () => call<Notice[]>(api.GET('/v1/me/notices'))

export const dismissNotice = (notice: string) =>
  call<void>(api.DELETE('/v1/me/notices/{id}', id(notice)))
