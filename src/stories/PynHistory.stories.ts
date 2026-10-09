import type { Meta, StoryObj } from '@storybook/vue3'
import PynHistory from '../components/PynHistory.vue'

const meta: Meta<typeof PynHistory> = { title: 'Repository/PynHistory', component: PynHistory }
export default meta
type Story = StoryObj<typeof PynHistory>

const revisions = [
  {
    id: 5,
    path: 'Content/Maps/Main.umap',
    author: 'alice',
    message: 'Restore r1',
    created_at: '2026-10-08T11:00:00Z',
    restored_from: 1,
  },
  {
    id: 4,
    path: 'Content/Textures/Wall.uasset',
    author: 'bob',
    message: 'Retouch the wall texture',
    created_at: '2026-10-08T09:30:00Z',
  },
  {
    id: 3,
    path: 'Source/Game.ts',
    author: 'alice',
    message: 'Spawn the player at the gate',
    created_at: '2026-10-07T16:20:00Z',
  },
  {
    id: 2,
    path: 'Content/Maps/Main.umap',
    author: 'bob',
    message: 'Add lighting',
    created_at: '2026-10-07T10:00:00Z',
  },
  {
    id: 1,
    path: 'Content/Maps/Main.umap',
    author: 'alice',
    message: 'First pass',
    created_at: '2026-10-06T09:00:00Z',
  },
]

export const Repository: Story = { args: { revisions, hasMore: true } }
export const Filtered: Story = {
  args: { revisions: revisions.filter((r) => r.path.endsWith('.uasset')), filter: '*.uasset' },
}
export const OneFile: Story = {
  args: { revisions: revisions.slice(3), path: 'Content/Maps/Main.umap' },
}
export const Loading: Story = { args: { revisions: [], loading: true } }
export const Empty: Story = { args: { revisions: [] } }
export const NoMatch: Story = { args: { revisions: [], filter: '*.xyz' } }
export const BadPattern: Story = {
  args: { revisions, filter: '[', error: 'invalid pattern: unclosed character class' },
}
