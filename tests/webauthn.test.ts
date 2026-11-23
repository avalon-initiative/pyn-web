import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, describeError } from '../src/api/client'
import {
  createPasskey,
  fromBase64Url,
  getPasskey,
  passkeyBrowserError,
  toBase64Url,
} from '../src/state/webauthn.state'

const bytes = (b: ArrayBuffer) => [...new Uint8Array(b)]

afterEach(() => vi.unstubAllGlobals())

describe('base64url', () => {
  it('round-trips without padding or the + and / characters', () => {
    const raw = new Uint8Array([251, 255, 190, 1, 2]).buffer
    const text = toBase64Url(raw)
    expect(text).toBe('-_--AQI')
    expect(bytes(fromBase64Url(text))).toEqual([251, 255, 190, 1, 2])
  })
})

const creation = {
  rp: { id: 'pyn.test', name: 'pyn' },
  user: { id: 'AQI', name: 'wendy', displayName: 'wendy' },
  challenge: 'AwQ',
  pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
  timeout: 1000,
  excludeCredentials: [{ type: 'public-key', id: 'BQY', transports: ['usb'] }],
  authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  attestation: 'none',
}

describe('passkey ceremonies', () => {
  it('uses the native parser and toJSON when the browser has them', async () => {
    const parse = vi.fn(() => ({ parsed: true }))
    vi.stubGlobal('PublicKeyCredential', { parseCreationOptionsFromJSON: parse })
    const create = vi.fn(async () => ({ toJSON: () => ({ id: 'cred', response: {} }) }))
    vi.stubGlobal('navigator', { credentials: { create } })
    const out = await createPasskey(creation)
    expect(parse).toHaveBeenCalledWith(creation)
    expect(create).toHaveBeenCalledWith({ publicKey: { parsed: true } })
    expect(out).toEqual({ id: 'cred', response: {} })
  })

  it('decodes and encodes by hand without the JSON helpers', async () => {
    vi.stubGlobal('PublicKeyCredential', {})
    const create = vi.fn(async () => ({
      id: 'cred',
      response: {
        clientDataJSON: new Uint8Array([1]).buffer,
        attestationObject: new Uint8Array([2]).buffer,
        getTransports: () => ['usb'],
      },
    }))
    vi.stubGlobal('navigator', { credentials: { create } })
    const out = await createPasskey(creation)
    const sent = (create.mock.calls[0] as unknown as [{ publicKey: Record<string, unknown> }])[0]
    expect(bytes(sent.publicKey.challenge as ArrayBuffer)).toEqual([3, 4])
    expect(bytes((sent.publicKey.user as { id: ArrayBuffer }).id)).toEqual([1, 2])
    expect(bytes((sent.publicKey.excludeCredentials as { id: ArrayBuffer }[])[0]!.id)).toEqual([
      5, 6,
    ])
    expect(out).toEqual({
      id: 'cred',
      response: { clientDataJSON: 'AQ', attestationObject: 'Ag', transports: ['usb'] },
    })
  })

  it('answers an authentication request by hand', async () => {
    vi.stubGlobal('PublicKeyCredential', {})
    const get = vi.fn(async () => ({
      id: 'cred',
      response: {
        clientDataJSON: new Uint8Array([1]).buffer,
        authenticatorData: new Uint8Array([2]).buffer,
        signature: new Uint8Array([3]).buffer,
        userHandle: null,
      },
    }))
    vi.stubGlobal('navigator', { credentials: { get } })
    const out = await getPasskey({
      challenge: 'AwQ',
      timeout: 1,
      rpId: 'pyn.test',
      allowCredentials: [],
      userVerification: 'required',
    })
    expect(out).toEqual({
      id: 'cred',
      response: {
        clientDataJSON: 'AQ',
        authenticatorData: 'Ag',
        signature: 'Aw',
        userHandle: null,
      },
    })
  })

  it('words a dismissed prompt and ignores other errors', () => {
    expect(passkeyBrowserError(new DOMException('x', 'NotAllowedError'))).toContain('cancelled')
    expect(passkeyBrowserError(new Error('x'))).toBeNull()
  })
})

describe('passkey error messages', () => {
  const text = (code: string) => describeError(new ApiError(401, code, 'x'))
  const generic = 'The passkey could not be verified. Try again, or use another passkey.'
  const notRegistered =
    'This passkey is not registered here, or it was registered before a fix; remove it and add it again.'
  const address = "The address in the browser does not match the server's public address."

  it('words each specific code', () => {
    expect(text('passkey_ceremony_expired')).toBe('The sign-in took too long. Try again.')
    expect(text('passkey_not_registered')).toBe(notRegistered)
    expect(text('passkey_user_handle_mismatch')).toBe(notRegistered)
    expect(text('passkey_origin_not_allowed')).toBe(address)
    expect(text('passkey_rp_id_mismatch')).toBe(address)
    expect(text('passkey_user_verification_required')).toBe(
      'Your device must verify you (PIN or biometrics).',
    )
    expect(text('passkey_counter_regressed')).toBe(
      'This passkey may have been copied; it was refused.',
    )
  })

  it('keeps the generic text for the rest', () => {
    for (const code of [
      'passkey_invalid',
      'passkey_challenge_mismatch',
      'passkey_signature_invalid',
      'passkey_replayed',
      'passkey_already_registered',
    ])
      expect(text(code)).toBe(generic)
  })
})
