import type { SshKey } from '../types/auth.types'
import { send } from './auth'

export function listKeys(): Promise<SshKey[]> {
  return send('GET', '/v1/keys')
}

export function addKey(key: string, title: string): Promise<SshKey> {
  return send('POST', '/v1/keys', { key, title: title.trim() || null })
}

export function removeKey(id: string): Promise<void> {
  return send('DELETE', `/v1/keys/${id}`)
}
