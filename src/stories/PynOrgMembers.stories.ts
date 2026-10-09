import type { Meta, StoryObj } from '@storybook/vue3'
import PynOrgMembers from '../components/PynOrgMembers.vue'
import { orgMembers } from './org-data'

const meta: Meta<typeof PynOrgMembers> = {
  title: 'Organizations/PynOrgMembers',
  component: PynOrgMembers,
  args: { members: orgMembers, self: 'alice', owner: true },
}
export default meta
type Story = StoryObj<typeof PynOrgMembers>

export const Owner: Story = {}
export const Member: Story = { args: { self: 'bob', owner: false } }
export const LastOwner: Story = {
  args: {
    error: 'An organization needs at least one owner. Make someone else an owner first.',
  },
}
export const NotAUser: Story = { args: { error: 'That account does not exist.' } }
