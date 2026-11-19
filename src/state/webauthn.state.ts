import type { Schemas } from '../api/schema'

type Json = Record<string, unknown>
type PkcStatics = {
  parseCreationOptionsFromJSON?: (o: Json) => PublicKeyCredentialCreationOptions
  parseRequestOptionsFromJSON?: (o: Json) => PublicKeyCredentialRequestOptions
}

const statics = (): PkcStatics => (globalThis.PublicKeyCredential ?? {}) as unknown as PkcStatics

export const passkeysSupported = () =>
  !!globalThis.PublicKeyCredential && !!globalThis.navigator?.credentials

export function fromBase64Url(text: string): ArrayBuffer {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer
}

export function toBase64Url(buf: ArrayBuffer | null | undefined): string {
  const bin = String.fromCharCode(...new Uint8Array(buf ?? new ArrayBuffer(0)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const descriptors = (list: Json[] | undefined) =>
  (list ?? []).map((d) => ({ ...d, id: fromBase64Url(d.id as string) }))

/** Browsers without `parseCreationOptionsFromJSON` get the base64url fields decoded by hand. */
function creationOptions(o: Json): PublicKeyCredentialCreationOptions {
  const native = statics().parseCreationOptionsFromJSON
  if (native) return native(o)
  const user = o.user as Json
  return {
    ...o,
    challenge: fromBase64Url(o.challenge as string),
    user: { ...user, id: fromBase64Url(user.id as string) },
    excludeCredentials: descriptors(o.excludeCredentials as Json[]),
  } as unknown as PublicKeyCredentialCreationOptions
}

function requestOptions(o: Json): PublicKeyCredentialRequestOptions {
  const native = statics().parseRequestOptionsFromJSON
  if (native) return native(o)
  return {
    ...o,
    challenge: fromBase64Url(o.challenge as string),
    allowCredentials: descriptors(o.allowCredentials as Json[]),
  } as unknown as PublicKeyCredentialRequestOptions
}

const jsonOf = (c: PublicKeyCredential): Json | null =>
  typeof (c as { toJSON?: unknown }).toJSON === 'function'
    ? (c as unknown as { toJSON: () => Json }).toJSON()
    : null

/** Runs the registration ceremony and returns the credential as the server expects it. */
export async function createPasskey(
  options: Schemas['PasskeyCreationOptions'],
): Promise<Schemas['PasskeyAttestationCredential']> {
  const c = (await navigator.credentials.create({
    publicKey: creationOptions(options as unknown as Json),
  })) as PublicKeyCredential | null
  if (!c) throw new DOMException('no credential', 'NotAllowedError')
  const native = jsonOf(c)
  if (native) return native as unknown as Schemas['PasskeyAttestationCredential']
  const r = c.response as AuthenticatorAttestationResponse
  return {
    id: c.id,
    response: {
      clientDataJSON: toBase64Url(r.clientDataJSON),
      attestationObject: toBase64Url(r.attestationObject),
      transports: r.getTransports?.() ?? [],
    },
  }
}

/** Runs the authentication ceremony (sign-in or fresh check). */
export async function getPasskey(
  options: Schemas['PasskeyRequestOptions'],
): Promise<Schemas['PasskeyAssertionCredential']> {
  const c = (await navigator.credentials.get({
    publicKey: requestOptions(options as unknown as Json),
  })) as PublicKeyCredential | null
  if (!c) throw new DOMException('no credential', 'NotAllowedError')
  const native = jsonOf(c)
  if (native) return native as unknown as Schemas['PasskeyAssertionCredential']
  const r = c.response as AuthenticatorAssertionResponse
  return {
    id: c.id,
    response: {
      clientDataJSON: toBase64Url(r.clientDataJSON),
      authenticatorData: toBase64Url(r.authenticatorData),
      signature: toBase64Url(r.signature),
      userHandle: r.userHandle ? toBase64Url(r.userHandle) : null,
    },
  }
}

/** Words a browser-side failure; the user dismissing the prompt is the common one. */
export function passkeyBrowserError(e: unknown): string | null {
  if (!(e instanceof DOMException)) return null
  if (e.name === 'NotAllowedError') return 'The passkey prompt was cancelled or timed out.'
  if (e.name === 'InvalidStateError') return 'This authenticator is already registered.'
  return `The browser could not use a passkey: ${e.message}`
}
