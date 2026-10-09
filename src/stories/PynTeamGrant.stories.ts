import type { Meta, StoryObj } from '@storybook/vue3'
import PynTeamGrant from '../components/PynTeamGrant.vue'

const meta: Meta<typeof PynTeamGrant> = {
  title: 'Repository/PynTeamGrant',
  component: PynTeamGrant,
  args: { teams: ['qa', 'artists'], roles: ['reader', 'writer', 'maintainer', 'admin'] },
}
export default meta
type Story = StoryObj<typeof PynTeamGrant>

export const Default: Story = {}
export const AllGranted: Story = { args: { teams: [] } }
export const Forbidden: Story = {
  args: { error: 'You lack a permission that role grants.' },
}
