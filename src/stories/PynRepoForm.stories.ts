import type { Meta, StoryObj } from '@storybook/vue3'
import PynRepoForm from '../components/PynRepoForm.vue'

const meta: Meta<typeof PynRepoForm> = { title: 'Repositories/PynRepoForm', component: PynRepoForm }
export default meta
type Story = StoryObj<typeof PynRepoForm>

export const Create: Story = { args: { owner: 'alice' } }
export const Edit: Story = {
  args: { owner: 'alice', repo: { name: 'game', visibility: 'public', lease_hours: 24 } },
}
export const NameTaken: Story = {
  args: { owner: 'alice', error: 'A repository with that name already exists for this owner.' },
}
