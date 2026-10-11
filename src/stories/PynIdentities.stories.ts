import type { Meta, StoryObj } from '@storybook/vue3'
import PynIdentities from '../components/PynIdentities.vue'

const meta: Meta<typeof PynIdentities> = {
  title: 'Account/PynIdentities',
  component: PynIdentities,
  args: { provider: { name: 'Acme SSO', sign_in_url: '/v1/oidc/authorize' } },
}
export default meta
type Story = StoryObj<typeof PynIdentities>

const identities = [
  {
    id: 'aaaaaaaaaaaa',
    issuer: 'https://id.acme.example',
    subject: 'u-1842',
    email: 'wendy@acme.example',
    created_at: '2026-10-08T09:00:00Z',
    last_sign_in_at: '2026-10-10T14:30:00Z',
  },
]

export const Linked: Story = { args: { identities } }
export const NothingLinked: Story = { args: { identities: [] } }
export const LastWayIn: Story = {
  args: { identities, error: 'This is the only way to sign in to the account.' },
}
