import type { Schemas } from '../api/schema'

/** The account behind `GET /v1/me`. */
export type AccountMe = Schemas['Account']

/** The deletion settings behind `GET /v1/admin/settings`. */
export type AdminSettings = Schemas['AdminSettings']

/** `GET /v1/setup`, the one place the access mode and the public address are read. */
export type ServerSetup = Schemas['SetupStatus']
