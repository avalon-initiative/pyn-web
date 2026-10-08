import type { Meta, StoryObj } from '@storybook/vue3'
import PynLockBadge from '../components/PynLockBadge.vue'

const now = new Date('2026-10-08T12:00:00Z')
const lock = (owner: string, minutesLeft: number) => ({
  path: 'Content/World/Dungeon.umap',
  owner,
  acquired_at: '2026-10-08T09:00:00Z',
  expires_at: new Date(now.getTime() + minutesLeft * 60_000).toISOString(),
})

const meta: Meta<typeof PynLockBadge> = {
  title: 'Locks/PynLockBadge',
  component: PynLockBadge,
  args: { now, me: 'alice' },
}
export default meta
type Story = StoryObj<typeof PynLockBadge>

export const Available: Story = {}
export const LockedByOther: Story = { args: { lock: lock('bob', 222) } }
export const LockedByYou: Story = { args: { lock: lock('alice', 222) } }
export const ExpiringSoon: Story = { args: { lock: lock('bob', 12) } }
export const ExpiredReadsAsAvailable: Story = { args: { lock: lock('bob', -5) } }
