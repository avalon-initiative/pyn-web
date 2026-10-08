import type { Meta, StoryObj } from '@storybook/vue3'
import PynFileList from '../components/PynFileList.vue'

const now = new Date('2026-10-08T12:00:00Z')
const lock = (path: string, owner: string, minutesLeft: number) => ({
  path,
  owner,
  acquired_at: '2026-10-08T09:00:00Z',
  expires_at: new Date(now.getTime() + minutesLeft * 60_000).toISOString(),
})

const meta: Meta<typeof PynFileList> = {
  title: 'Locks/PynFileList',
  component: PynFileList,
  args: { now, me: 'alice' },
}
export default meta
type Story = StoryObj<typeof PynFileList>

/** Repository mockup with lock badges. */
export const GameRepository: Story = {
  args: {
    rows: [
      {
        path: 'Content/World/Main.umap',
        mode: 'exclusive',
        revision: 61,
        lock: lock('Content/World/Main.umap', 'alice', 222),
      },
      { path: 'Content/World/Dungeon.umap', mode: 'exclusive', revision: 184 },
      {
        path: 'Content/Enemies/Boss.uasset',
        mode: 'exclusive',
        revision: 12,
        lock: lock('Content/Enemies/Boss.uasset', 'bob', 15),
      },
      { path: 'Source/Player.cpp', mode: 'shared', revision: 382 },
      { path: 'Source/Enemy.cpp', mode: 'shared', revision: 97 },
    ],
  },
}
export const Empty: Story = { args: { rows: [] } }
