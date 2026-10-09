import type { Meta, StoryObj } from '@storybook/vue3'
import PynMembers from '../components/PynMembers.vue'
import { teamGrantees } from '../state/team.state'
import { repoTeams } from './org-data'

const meta: Meta<typeof PynMembers> = { title: 'Repository/PynMembers', component: PynMembers }
export default meta
type Story = StoryObj<typeof PynMembers>

const roles = ['reader', 'writer', 'maintainer', 'admin']
const grantees = [
  { name: 'alice', role: 'admin', source: 'org_owner' as const },
  { name: 'bob', role: 'writer', source: 'direct' as const },
  { name: 'carol', role: 'reader', source: 'team' as const },
]

export const Members: Story = { args: { grantees, roles } }
export const Empty: Story = { args: { grantees: [], roles } }
export const Teams: Story = {
  args: {
    grantees: teamGrantees('studio', repoTeams),
    roles,
    kind: 'team',
    title: 'Teams',
    revocable: true,
  },
}
export const NotAllowed: Story = {
  args: { grantees, roles, error: 'You lack a permission that role grants.' },
}
