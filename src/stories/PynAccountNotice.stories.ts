import type { Meta, StoryObj } from '@storybook/vue3'
import PynAccountNotice from '../components/PynAccountNotice.vue'

const meta: Meta<typeof PynAccountNotice> = {
  title: 'Account/PynAccountNotice',
  component: PynAccountNotice,
  args: { status: 'pending_verification', user: 'wendy' },
}
export default meta
type Story = StoryObj<typeof PynAccountNotice>

export const PendingVerification: Story = {}
export const Resent: Story = { args: { sent: true } }
export const ResendRateLimited: Story = {
  args: { error: 'Too many attempts. Try again in 1 hour.' },
}
export const PendingApproval: Story = { args: { status: 'pending_approval' } }
export const Disabled: Story = { args: { status: 'account_disabled' } }
