import type { ProfileValues } from '@avalon-initiative/pyn-common-ui'
import type { Schemas } from './schema'
import { api, binaryBody, call } from './http'

export type PublicProfile = Schemas['PublicProfile']
export type Profile = Schemas['Profile']

export const getProfile = (user: string) =>
  call<PublicProfile>(api.GET('/v1/users/{user}', { params: { path: { user } } }))

export const saveProfile = (values: ProfileValues) =>
  call<Profile>(api.PUT('/v1/me/profile', { body: values }))

export const uploadAvatar = (file: File) =>
  call<Profile>(api.PUT('/v1/me/avatar', binaryBody(file, file.type)))

export const removeAvatar = () => call<Profile>(api.DELETE('/v1/me/avatar'))

export type StarredRepo = Schemas['StarredRepo']

export const listStarred = (user: string) =>
  call<StarredRepo[]>(api.GET('/v1/users/{user}/starred', { params: { path: { user } } }))
