import type { Meta, StoryObj } from '@storybook/vue3'
import PynActivity from '../components/PynActivity.vue'
import { now, summary } from './landing-data'

const meta: Meta<typeof PynActivity> = {
  title: 'Browse/PynActivity',
  component: PynActivity,
  args: { entries: summary.activity, now },
}
export default meta
type Story = StoryObj<typeof PynActivity>

export const Default: Story = {}
export const Empty: Story = { args: { entries: [] } }
