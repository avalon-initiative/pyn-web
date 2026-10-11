import type { SetupForm } from '../types/auth.types'

export const SETUP_STEPS = [
  'welcome',
  'token',
  'admin',
  'server',
  'registration',
  'review',
] as const
export type SetupStep = (typeof SETUP_STEPS)[number]

/** Whether the step's required fields are filled so the wizard may move on. */
export function stepComplete(step: SetupStep, form: SetupForm): boolean {
  if (step === 'token') return form.token.trim() !== ''
  if (step === 'admin') return form.username.trim() !== '' && form.password !== ''
  return true
}

export const REGISTRATION_LABELS: Record<SetupForm['registration'], string> = {
  open: 'Open: anyone can create an account',
  invite: 'Invitation only',
  closed: 'Closed: administrators add accounts',
}
