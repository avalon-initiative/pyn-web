import minServer from '../../min-server.json'

export const minServerVersion: string = minServer.min_server

function triple(v: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** Compares X.Y.Z numerically, ignoring any pre-release suffix; null when either side is not a version. */
export function compareVersions(a: string, b: string): number | null {
  const x = triple(a)
  const y = triple(b)
  if (!x || !y) return null
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1
  return 0
}

/** True only when the server reports a version strictly older than the minimum. */
export function serverTooOld(serverVersion: string | undefined, min = minServerVersion): boolean {
  return !!serverVersion && compareVersions(serverVersion, min) === -1
}
