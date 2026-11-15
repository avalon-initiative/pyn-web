import type { ProfileValues } from '@avalon-initiative/pyn-common-ui'
import type { Schemas } from './schema'
import { csrfHeaders } from '../state/csrf.state'
import { api, call, failure } from './http'

export type PublicProfile = Schemas['PublicProfile']
export type Profile = Schemas['Profile']

export const getProfile = (user: string) =>
  call<PublicProfile>(api.GET('/v1/users/{user}', { params: { path: { user } } }))

export const saveProfile = (values: ProfileValues) =>
  call<Profile>(api.PUT('/v1/me/profile', { body: values }))

// Raw bytes: the typed client's same-origin fetch reads bodies as text.
export async function uploadAvatar(file: File): Promise<Profile> {
  const res = await fetch('/v1/me/avatar', {
    method: 'PUT',
    headers: { ...csrfHeaders('PUT'), 'Content-Type': file.type },
    body: file,
  })
  if (!res.ok) throw await failure(res)
  return (await res.json()) as Profile
}

export const removeAvatar = () => call<Profile>(api.DELETE('/v1/me/avatar'))
