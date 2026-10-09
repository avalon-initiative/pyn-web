import type { Meta, StoryObj } from '@storybook/vue3'
import PynOrgDelete from '../components/PynOrgDelete.vue'

const meta: Meta<typeof PynOrgDelete> = {
  title: 'Organizations/PynOrgDelete',
  component: PynOrgDelete,
  args: { name: 'studio' },
}
export default meta
type Story = StoryObj<typeof PynOrgDelete>

export const Default: Story = {}
export const NotEmpty: Story = {
  args: { error: 'Delete the repositories the organization owns first.' },
}
