import type { Meta, StoryObj } from '@storybook/vue3'
import PynMembers from '../components/PynMembers.vue'

const meta: Meta<typeof PynMembers> = { title: 'Repository/PynMembers', component: PynMembers }
export default meta
type Story = StoryObj<typeof PynMembers>

const roles = ['reader', 'writer', 'maintainer', 'admin']
const members = [
  { user: 'alice', role: 'admin' },
  { user: 'bob', role: 'writer' },
]

export const Members: Story = { args: { members, roles } }
export const UserExists: Story = {
  args: { members, roles, error: 'that user name is already taken' },
}
