import type { Meta, StoryObj } from '@storybook/vue3'
import PynOrgForm from '../components/PynOrgForm.vue'

const meta: Meta<typeof PynOrgForm> = { title: 'Organizations/PynOrgForm', component: PynOrgForm }
export default meta
type Story = StoryObj<typeof PynOrgForm>

export const Default: Story = {}
export const NameTaken: Story = {
  args: { error: 'That name is already taken by a user or an organization.' },
}
export const Restricted: Story = { args: { error: 'Only a server administrator can do that.' } }
