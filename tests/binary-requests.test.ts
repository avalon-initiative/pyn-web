import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../src/api/client'
import { api, binaryBody } from '../src/api/http'
import { uploadAvatar } from '../src/api/profile'
import { putObject } from '../src/api/repos'

const r = { owner: 'acme', name: 'game' }
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255, 128, 13, 10])

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function stub(res: () => Response) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => res())
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function sentBytes(init?: RequestInit) {
  return Array.from(new Uint8Array(await new Response(init?.body).arrayBuffer()))
}

afterEach(() => vi.unstubAllGlobals())

describe('binary request bodies', () => {
  it('sends a File avatar byte for byte with its type', async () => {
    const f = stub(() => json({ id: 'u1' }))
    await uploadAvatar(new File([png], 'a.png', { type: 'image/png' }))
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe('/v1/me/avatar')
    expect(init?.method).toBe('PUT')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('image/png')
    expect(await sentBytes(init)).toEqual(Array.from(png))
  })

  it('sends object text as UTF-8 octets', async () => {
    const f = stub(() => json({ content: 'blob1' }))
    expect(await putObject(r, 'héllo')).toBe('blob1')
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe('/v1/repos/acme/game/objects')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/octet-stream')
    expect(await sentBytes(init)).toEqual(Array.from(new TextEncoder().encode('héllo')))
  })

  it('passes a Blob and an ArrayBuffer through unchanged', async () => {
    const f = stub(() => json({ content: 'x' }))
    const opts = { params: { path: r } }
    const type = 'application/octet-stream'
    await api.PUT('/v1/repos/{owner}/{name}/objects', {
      ...opts,
      ...binaryBody(new Blob([png]), type),
    })
    await api.PUT('/v1/repos/{owner}/{name}/objects', {
      ...opts,
      ...binaryBody(png.buffer as ArrayBuffer, type),
    })
    for (const [, init] of f.mock.calls) expect(await sentBytes(init)).toEqual(Array.from(png))
  })

  it('turns a failed upload into an ApiError', async () => {
    stub(() => json({ code: 'too_large', message: 'too big' }, 413))
    await expect(uploadAvatar(new File([png], 'a.png', { type: 'image/png' }))).rejects.toEqual(
      new ApiError(413, 'too_large', 'too big'),
    )
  })
})

describe('JSON requests', () => {
  it('are still sent as the JSON text', async () => {
    const f = stub(() => json({}))
    await api.PUT('/v1/me/profile', { body: { display_name: 'Ada' } as never })
    const [, init] = f.mock.calls[0]!
    expect(init?.body).toBe('{"display_name":"Ada"}')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
  })
})
