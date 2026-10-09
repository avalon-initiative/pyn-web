import type { Meta, StoryObj } from '@storybook/vue3'
import PynInvites from '../components/PynInvites.vue'

const meta: Meta<typeof PynInvites> = { title: 'Repository/PynInvites', component: PynInvites }
export default meta
type Story = StoryObj<typeof PynInvites>

const roles = ['reader', 'writer', 'maintainer']
const invites = [
  {
    id: 'aaaa',
    role: 'writer',
    created_by: 'alice',
    created_at: '2026-10-08T09:00:00Z',
    expires_at: '2026-10-11T09:00:00Z',
  },
  {
    id: 'bbbb',
    role: 'reader',
    created_by: 'alice',
    created_at: '2026-10-01T09:00:00Z',
    expires_at: '2026-10-04T09:00:00Z',
    used_by: 'wendy',
    used_at: '2026-10-02T09:00:00Z',
  },
  {
    id: 'cccc',
    role: 'reader',
    created_by: 'alice',
    created_at: '2026-10-01T09:00:00Z',
    expires_at: '2026-10-04T09:00:00Z',
    revoked_at: '2026-10-02T09:00:00Z',
  },
]

export const Invitations: Story = { args: { invites, roles } }
export const JustCreated: Story = { args: { invites, roles, code: 'pyni_8d2f0c91' } }
export const None: Story = { args: { invites: [], roles } }
