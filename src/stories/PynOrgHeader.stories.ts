import type { Meta, StoryObj } from '@storybook/vue3'
import PynOrgHeader from '../components/PynOrgHeader.vue'

const meta: Meta<typeof PynOrgHeader> = {
  title: 'Organizations/PynOrgHeader',
  component: PynOrgHeader,
  args: { name: 'studio', createdAt: '2026-09-02T08:00:00Z' },
}
export default meta
type Story = StoryObj<typeof PynOrgHeader>

export const Owner: Story = { args: { role: 'owner', current: '' } }
export const Member: Story = { args: { role: 'member', current: 'members' } }
export const Visitor: Story = {}
