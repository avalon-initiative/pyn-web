import type { Meta, StoryObj } from '@storybook/vue3'
import PynAccounts from '../components/PynAccounts.vue'
import { accounts } from './admin-data'

const meta: Meta<typeof PynAccounts> = {
  title: 'Admin/PynAccounts',
  component: PynAccounts,
  args: { accounts, status: '', self: 'root' },
}
export default meta
type Story = StoryObj<typeof PynAccounts>

export const Default: Story = {}
export const WaitingForApproval: Story = {
  args: { accounts: accounts.slice(1, 2), status: 'pending_approval' },
}
export const Failed: Story = { args: { error: 'That account does not exist.' } }
export const None: Story = { args: { accounts: [], status: 'active' } }
