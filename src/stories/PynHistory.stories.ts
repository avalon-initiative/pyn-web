import type { Meta, StoryObj } from '@storybook/vue3'
import PynHistory from '../components/PynHistory.vue'

const meta: Meta<typeof PynHistory> = { title: 'Repository/PynHistory', component: PynHistory }
export default meta
type Story = StoryObj<typeof PynHistory>

const path = 'Content/Maps/Main.umap'
const revisions = [
  {
    id: 3,
    path,
    author: 'alice',
    message: 'Restore r1',
    created_at: '2026-10-08T11:00:00Z',
    restored_from: 1,
  },
  { id: 2, path, author: 'bob', message: 'Add lighting', created_at: '2026-10-07T16:20:00Z' },
  { id: 1, path, author: 'alice', message: 'First pass', created_at: '2026-10-06T09:00:00Z' },
]

export const WithRevisions: Story = { args: { path, revisions } }
export const NoPath: Story = { args: { path: '', revisions: [] } }
export const NoRevisions: Story = { args: { path, revisions: [] } }
