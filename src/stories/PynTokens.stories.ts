import type { Meta, StoryObj } from '@storybook/vue3'
import PynTokens from '../components/PynTokens.vue'

const meta: Meta<typeof PynTokens> = {
  title: 'Account/PynTokens',
  component: PynTokens,
}
export default meta
type Story = StoryObj<typeof PynTokens>

const tokens = [
  {
    id: 'aaaaaaaaaaaa',
    user: 'alice',
    name: 'ci',
    repos: ['acme/game'],
    permissions: ['read', 'lock', 'checkin'],
    created_at: '2026-10-08T09:00:00Z',
    expires_at: '2027-01-01T00:00:00Z',
    last_used_at: '2026-10-09T14:30:00Z',
  },
  {
    id: 'bbbbbbbbbbbb',
    user: 'alice',
    name: 'old script',
    repos: ['acme/game', 'acme/tools'],
    permissions: ['read'],
    created_at: '2026-09-01T09:00:00Z',
    revoked_at: '2026-10-01T09:00:00Z',
  },
]

export const WithTokens: Story = { args: { tokens } }
export const NoTokens: Story = { args: { tokens: [] } }
export const JustCreated: Story = { args: { tokens, secret: 'pyn_3f9c0d5b7a1e48d2' } }
export const Refused: Story = { args: { tokens, error: 'unknown repository acme/nope' } }
