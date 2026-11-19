import { afterEach, describe, expect, it, vi } from 'vitest'
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
