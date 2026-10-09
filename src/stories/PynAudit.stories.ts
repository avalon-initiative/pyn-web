import type { Meta, StoryObj } from '@storybook/vue3'
import PynAudit from '../components/PynAudit.vue'

const meta: Meta<typeof PynAudit> = { title: 'Repository/PynAudit', component: PynAudit }
export default meta
type Story = StoryObj<typeof PynAudit>

const filter = { path: '', actor: '', action: '' }
const entries = [
  {
    id: 4,
    at: '2026-10-08T11:00:00Z',
    actor: 'alice',
    action: 'repo_updated',
    detail: 'visibility private -> public',
  },
  {
    id: 3,
    at: '2026-10-08T10:30:00Z',
    actor: 'bob',
    action: 'checkout',
    detail: 'lease 8h',
    path: 'Content/a.umap',
  },
  {
    id: 2,
    at: '2026-10-08T10:00:00Z',
    actor: 'alice',
    action: 'member_added',
    detail: 'bob as writer',
  },
  {
    id: 1,
    at: '2026-10-08T09:00:00Z',
    actor: 'alice',
    action: 'repo_created',
    detail: 'alice/game',
  },
]

export const Events: Story = { args: { entries, filter, hasMore: true } }
export const Empty: Story = { args: { entries: [], filter: { ...filter, actor: 'zed' } } }
