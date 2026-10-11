import type { Meta, StoryObj } from '@storybook/vue3'
import PynSetup from '../components/PynSetup.vue'

const meta: Meta<typeof PynSetup> = {
  title: 'Account/PynSetup',
  component: PynSetup,
  args: { registration: 'closed', publicUrl: 'http://localhost:7878' },
}
export default meta
type Story = StoryObj<typeof PynSetup>

export const Welcome: Story = {}
export const WrongToken: Story = { args: { error: 'the setup token is not valid' } }
export const RateLimited: Story = { args: { error: 'too many attempts; try again in 15 minutes' } }
export const Finished: Story = { args: { done: true } }
