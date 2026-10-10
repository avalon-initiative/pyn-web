import type { SshKey } from '../types/auth.types'
import { api, call } from './http'

export const listKeys = () => call<SshKey[]>(api.GET('/v1/keys'))

export const addKey = (key: string, title: string) =>
  call<SshKey>(api.POST('/v1/keys', { body: { key, title: title.trim() || null } }))

export const removeKey = (id: string) =>
  call<void>(api.DELETE('/v1/keys/{id}', { params: { path: { id } } }))
