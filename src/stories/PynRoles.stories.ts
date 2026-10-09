import type { Meta, StoryObj } from '@storybook/vue3'
import PynRoles from '../components/PynRoles.vue'

const meta: Meta<typeof PynRoles> = { title: 'Repository/PynRoles', component: PynRoles }
export default meta
type Story = StoryObj<typeof PynRoles>

const grants = [
  { role: 'reader', permissions: ['read'] },
  { role: 'writer', permissions: ['read', 'lock', 'checkin'] },
  { role: 'admin', permissions: ['read', 'lock', 'checkin', 'manage_users', 'manage_roles'] },
]

export const Editable: Story = { args: { grants, canEdit: true } }
export const ReadOnly: Story = { args: { grants } }
