import type { Meta, StoryObj } from '@storybook/vue3'
import PynTeamDetail from '../components/PynTeamDetail.vue'
import { teams } from './org-data'

const meta: Meta<typeof PynTeamDetail> = {
  title: 'Organizations/PynTeamDetail',
  component: PynTeamDetail,
  args: { team: teams[0], candidates: ['alice', 'dave'], owner: true },
}
export default meta
type Story = StoryObj<typeof PynTeamDetail>

export const Owner: Story = {}
export const Member: Story = { args: { owner: false } }
export const Empty: Story = { args: { team: teams[1] } }
export const NotAMember: Story = {
  args: { error: 'That user is not a member of the organization.' },
}
