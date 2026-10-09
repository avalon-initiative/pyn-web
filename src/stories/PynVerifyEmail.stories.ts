import type { Meta, StoryObj } from '@storybook/vue3'
import PynVerifyEmail from '../components/PynVerifyEmail.vue'

const meta: Meta<typeof PynVerifyEmail> = {
  title: 'Account/PynVerifyEmail',
  component: PynVerifyEmail,
  args: { outcome: 'verified', status: 'active', user: 'wendy' },
}
export default meta
type Story = StoryObj<typeof PynVerifyEmail>

export const Verifying: Story = { args: { outcome: 'verifying' } }
export const Verified: Story = {}
export const VerifiedAwaitingApproval: Story = { args: { status: 'pending_approval' } }
export const InvalidLink: Story = { args: { outcome: 'invalid', status: undefined } }
export const ResendSent: Story = { args: { outcome: 'invalid', status: undefined, sent: true } }
export const ResendRateLimited: Story = {
  args: {
    outcome: 'invalid',
    status: undefined,
    resendError: 'Too many attempts. Try again in 38 minutes.',
  },
}
