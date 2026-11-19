import createClient from 'openapi-fetch'
import { csrfHeaders } from '../state/csrf.state'
import { reportPendingDeletion } from '../state/pending.state'
import { reportEnrolmentRequired } from '../state/two-factor.state'
import { ApiError } from './client'
import type { paths } from './schema.gen'

/** The `ApiError` for a non-2xx response, from the server's error body when it has one. */
export async function failure(res: Response): Promise<ApiError> {
  const err = await res
    .json()
    .catch(() => ({ code: 'error', message: `server returned ${res.status}` }))
  const wait = Number.parseInt(res.headers.get('Retry-After') ?? '', 10)
  const b = err.blockers
  const blockers = b ? { repos: b.repositories ?? [], orgs: b.organizations ?? [] } : undefined
  reportPendingDeletion(err.code)
  reportEnrolmentRequired(err.code)
  return new ApiError(
    res.status,
    err.code,
    err.message,
    Number.isNaN(wait) ? undefined : wait,
    blockers,
  )
}

const isBinary = (type: string | null) => /^(application\/octet-stream|image\/)/i.test(type ?? '')

// Requests are same-origin and relative: the client builds absolute URLs, so strip the origin back off.
// Binary bodies pass through as bytes; everything else is read as text.
async function sameOriginFetch(req: Request): Promise<Response> {
  const url = new URL(req.url)
  let body: BodyInit | undefined
  if (req.body)
    body = isBinary(req.headers.get('Content-Type')) ? await req.arrayBuffer() : await req.text()
  return globalThis.fetch(`${url.pathname}${url.search}`, {
    method: req.method,
    headers: req.headers,
    body,
  })
}

/** Request options that send `body` unserialized under `type`; the schema types binary bodies as arrays or strings. */
export const binaryBody = (body: Blob | ArrayBuffer | Uint8Array, type: string) => ({
  body: body as never,
  bodySerializer: (b: unknown) => b as BodyInit,
  headers: { 'Content-Type': type },
})

export const api = createClient<paths>({
  baseUrl: globalThis.location?.origin ?? 'http://localhost',
  fetch: sameOriginFetch,
})

api.use({
  onRequest({ request }) {
    for (const [k, v] of Object.entries(csrfHeaders(request.method))) request.headers.set(k, v)
    return request
  },
  async onResponse({ response }) {
    if (!response.ok) throw await failure(response)
  },
})

/** The success body of a call; a non-2xx response has already thrown an `ApiError`. */
export async function call<T>(request: Promise<{ data?: T }>): Promise<T> {
  return (await request).data as T
}
