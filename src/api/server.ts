import type { ServerBuild } from '../types/version.types'
import { api, call } from './http'

type Capabilities = { version?: string; revision?: string | null }

/** The server's build, or null when it cannot be reached or is too old to report a version. */
export async function fetchServerBuild(): Promise<ServerBuild | null> {
  try {
    const caps = await call<Capabilities>(api.GET('/v1/capabilities'))
    return caps.version ? { version: caps.version, revision: caps.revision ?? '' } : null
  } catch {
    return null
  }
}
