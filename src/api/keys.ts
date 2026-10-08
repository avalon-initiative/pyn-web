import type { SshKey } from '../types/auth.types'
import { send } from './auth'

export function listKeys(credential: string): Promise<SshKey[]> {
  return send('GET', '/v1/keys', undefined, credential)
}

export function addKey(credential: string, key: string, title: string): Promise<SshKey> {
  return send('POST', '/v1/keys', { key, title: title.trim() || null }, credential)
}

export function removeKey(credential: string, id: string): Promise<void> {
  return send('DELETE', `/v1/keys/${id}`, undefined, credential)
}
