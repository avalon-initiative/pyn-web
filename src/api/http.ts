import createClient from 'openapi-fetch'
import { csrfHeaders } from '../state/csrf.state'
import { ApiError } from './client'
import type { paths } from './schema.gen'

/** The `ApiError` for a non-2xx response, from the server's error body when it has one. */
export async function failure(res: Response): Promise<ApiError> {
  const err = await res
    .json()
    .catch(() => ({ code: 'error', message: `server returned ${res.status}` }))
  const wait = Number.parseInt(res.headers.get('Retry-After') ?? '', 10)
  return new ApiError(res.status, err.code, err.message, Number.isNaN(wait) ? undefined : wait)
}

// Requests are same-origin and relative: the client builds absolute URLs, so strip the origin back off.
async function sameOriginFetch(req: Request): Promise<Response> {
  const url = new URL(req.url)
  return globalThis.fetch(`${url.pathname}${url.search}`, {
    method: req.method,
    headers: req.headers,
    body: req.body ? await req.text() : undefined,
  })
}

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
