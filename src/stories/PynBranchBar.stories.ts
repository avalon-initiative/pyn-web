import type { Meta, StoryObj } from '@storybook/vue3'
import PynBranchBar from '../components/PynBranchBar.vue'
import { now, summary } from './landing-data'

const meta: Meta<typeof PynBranchBar> = {
  title: 'Browse/PynBranchBar',
  component: PynBranchBar,
  args: { branch: 'main', files: summary.files, updatedAt: summary.updated_at, now },
}
export default meta
type Story = StoryObj<typeof PynBranchBar>

export const Default: Story = {}
export const Empty: Story = { args: { files: 0, updatedAt: null } }
