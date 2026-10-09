import type { Meta, StoryObj } from '@storybook/vue3'
import PynTeamForm from '../components/PynTeamForm.vue'
import { teams } from './org-data'

const meta: Meta<typeof PynTeamForm> = {
  title: 'Organizations/PynTeamForm',
  component: PynTeamForm,
}
export default meta
type Story = StoryObj<typeof PynTeamForm>

export const Create: Story = {}
export const Exists: Story = {
  args: { error: 'A team with that name already exists in the organization.' },
}
export const Edit: Story = { args: { team: teams[0] } }
