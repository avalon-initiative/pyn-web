import type { Meta, StoryObj } from '@storybook/vue3'
import PynFileBar from '../components/PynFileBar.vue'
import { fileEntry, lockedEntry } from './file-data'
import { now } from './landing-data'

const meta: Meta<typeof PynFileBar> = {
  title: 'File/PynFileBar',
  component: PynFileBar,
  args: { owner: 'acme', name: 'castle-quest', me: 'jamie', now, entry: fileEntry },
}
export default meta
type Story = StoryObj<typeof PynFileBar>

export const Shared: Story = {}
export const LockedByOther: Story = { args: { entry: lockedEntry } }
export const NoRevision: Story = {
  args: {
    entry: { ...lockedEntry, last_change: null, lock: { ...lockedEntry.lock!, owner: 'jamie' } },
  },
}
