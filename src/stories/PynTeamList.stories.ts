import type { Meta, StoryObj } from '@storybook/vue3'
import PynTeamList from '../components/PynTeamList.vue'
import { teams } from './org-data'

const meta: Meta<typeof PynTeamList> = {
  title: 'Organizations/PynTeamList',
  component: PynTeamList,
  args: { org: 'studio', teams },
}
export default meta
type Story = StoryObj<typeof PynTeamList>

export const Default: Story = {}
export const Empty: Story = { args: { teams: [] } }
