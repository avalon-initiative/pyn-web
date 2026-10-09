import type { Meta, StoryObj } from '@storybook/vue3'
import PynTree from '../components/PynTree.vue'
import { now, rootEntries } from './landing-data'

const meta: Meta<typeof PynTree> = {
  title: 'Browse/PynTree',
  component: PynTree,
  args: { owner: 'acme', name: 'castle-quest', me: 'jamie', now },
}
export default meta
type Story = StoryObj<typeof PynTree>

export const Root: Story = { args: { entries: rootEntries } }
export const Empty: Story = { args: { entries: [] } }
