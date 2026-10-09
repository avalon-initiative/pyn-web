import type { Meta, StoryObj } from '@storybook/vue3'
import PynResendForm from '../components/PynResendForm.vue'

const meta: Meta<typeof PynResendForm> = {
  title: 'Account/PynResendForm',
  component: PynResendForm,
}
export default meta
type Story = StoryObj<typeof PynResendForm>

export const Empty: Story = {}
export const Sent: Story = { args: { sent: true } }
export const RateLimited: Story = { args: { error: 'Too many attempts. Try again in 38 minutes.' } }
