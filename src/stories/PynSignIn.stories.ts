import type { Meta, StoryObj } from '@storybook/vue3'
import PynSignIn from '../components/PynSignIn.vue'

const meta: Meta<typeof PynSignIn> = {
  title: 'Account/PynSignIn',
  component: PynSignIn,
  args: { registration: 'invite' },
}
export default meta
type Story = StoryObj<typeof PynSignIn>

export const InviteOnlyServer: Story = {}
export const OpenServer: Story = { args: { registration: 'open' } }
export const ClosedServer: Story = { args: { registration: 'closed' } }
export const WrongPassword: Story = {
  args: { error: 'authentication failed: wrong user name or password' },
}
