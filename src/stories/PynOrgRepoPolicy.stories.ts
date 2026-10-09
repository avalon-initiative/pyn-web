import type { Meta, StoryObj } from '@storybook/vue3'
import PynOrgRepoPolicy from '../components/PynOrgRepoPolicy.vue'
import { orgMembers, repoPolicy, teams } from './org-data'

const meta: Meta<typeof PynOrgRepoPolicy> = {
  title: 'Organizations/PynOrgRepoPolicy',
  component: PynOrgRepoPolicy,
  args: {
    policy: repoPolicy,
    teams: teams.map((t) => t.slug),
    members: orgMembers.map((m) => m.user),
  },
}
export default meta
type Story = StoryObj<typeof PynOrgRepoPolicy>

export const Default: Story = {}
export const OwnersOnly: Story = { args: { policy: { member_creation: 'none', rules: [] } } }
export const NotATeam: Story = { args: { error: 'That team does not exist.' } }
