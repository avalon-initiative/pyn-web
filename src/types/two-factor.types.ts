import type { Schemas } from '../api/schema'

export type { Notice, TwoFactorRequired, TwoFactorStatus } from '@avalon-initiative/pyn-common-ui'
export type TotpConfirmed = Schemas['TotpConfirmed']
export type PasskeyRegistered = Schemas['PasskeyRegistered']
export type PasskeyCreation = Schemas['PasskeyRegistrationBegun']
export type PasskeyRequest = Schemas['PasskeyAuthenticationBegun']
export type FreshCheck = Schemas['FreshCheck']
