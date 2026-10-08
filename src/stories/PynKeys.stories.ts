import type { Meta, StoryObj } from '@storybook/vue3'
import PynKeys from '../components/PynKeys.vue'

const meta: Meta<typeof PynKeys> = {
  title: 'Account/PynKeys',
  component: PynKeys,
}
export default meta
type Story = StoryObj<typeof PynKeys>

const keys = [
  {
    id: 'aaaaaaaaaaaa',
    title: 'work laptop',
    algorithm: 'ssh-ed25519',
    fingerprint: 'SHA256:bVz0kqJTy+oVP03XmSg3A9OmlgA/TUvtGJ2SJQP+qMI',
    created_at: '2026-10-08T09:00:00Z',
    last_used_at: '2026-10-09T14:30:00Z',
  },
  {
    id: 'bbbbbbbbbbbb',
    title: 'desktop',
    algorithm: 'ecdsa-sha2-nistp256',
    fingerprint: 'SHA256:LLK4D9e6kVbGiWgEmE4sJFWnqQPJMstHEmXo2YhqNJc',
    created_at: '2026-10-01T09:00:00Z',
    last_used_at: null,
  },
]

export const WithKeys: Story = { args: { keys } }
export const NoKeys: Story = { args: { keys: [] } }
export const KeyRefused: Story = {
  args: { keys, error: 'RSA keys must be at least 2048 bits; this one is 1024' },
}
