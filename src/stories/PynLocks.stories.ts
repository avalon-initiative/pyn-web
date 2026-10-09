import type { Meta, StoryObj } from '@storybook/vue3'
import PynLocks from '../components/PynLocks.vue'

const meta: Meta<typeof PynLocks> = { title: 'Repository/PynLocks', component: PynLocks }
export default meta
type Story = StoryObj<typeof PynLocks>

const now = new Date('2026-10-08T12:00:00Z')
const locks = [
  {
    path: 'Content/Maps/Main.umap',
    owner: 'bob',
    acquired_at: '2026-10-08T09:00:00Z',
    expires_at: '2026-10-08T15:42:00Z',
  },
  {
    path: 'Content/Art/Hero.psd',
    owner: 'carol',
    acquired_at: '2026-10-08T10:00:00Z',
    expires_at: '2026-10-08T12:12:00Z',
  },
]

export const Locked: Story = { args: { locks, now } }
export const WithForceUnlock: Story = { args: { locks, now, canForce: true } }
export const None: Story = { args: { locks: [], now } }
