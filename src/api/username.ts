import type { RenameForm } from '@avalon-initiative/pyn-common-ui'
import type { Schemas } from './schema'
import { api, call } from './http'

export type Renamed = Schemas['Renamed']

export const renameAccount = (form: RenameForm) =>
  call<Renamed>(
    api.PUT('/v1/me/username', { body: { username: form.username, password: form.password } }),
  )
