import type { Meta, StoryObj } from '@storybook/vue3'
import PynMyLocks from '../components/PynMyLocks.vue'

const meta: Meta<typeof PynMyLocks> = { title: 'Account/PynMyLocks', component: PynMyLocks }
export default meta
type Story = StoryObj<typeof PynMyLocks>

const now = new Date('2026-10-08T12:00:00Z')
const locks = [
  {
    owner: 'alice',
    name: 'castle-quest',
    path: 'Content/Maps/Main.umap',
    acquired_at: '2026-10-08T09:00:00Z',
    expires_at: '2026-10-08T15:42:00Z',
  },
  {
    owner: 'alice',
    name: 'castle-quest',
    path: 'Content/Art/Hero.psd',
    acquired_at: '2026-10-08T10:00:00Z',
    expires_at: '2026-10-08T12:12:00Z',
  },
  {
    owner: 'studio',
    name: 'core-engine',
    path: 'Source/Player.cpp',
    acquired_at: '2026-10-08T11:00:00Z',
    expires_at: '2026-10-08T19:00:00Z',
  },
]

export const Default: Story = { args: { locks, now } }
export const PartialFailure: Story = {
  args: {
    locks: locks.slice(1),
    now,
    failures: [{ lock: locks[1], message: 'Could not reach pyn-server: network error' }],
  },
}
export const None: Story = { args: { locks: [], now } }
