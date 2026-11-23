import { ApiError } from '../api/client'

/** A signed-out read the server refused: 404 for a private repository, 401 on a private server. */
export const refusedSignedOut = (e: unknown) =>
  e instanceof ApiError && (e.status === 401 || e.status === 404)
