import type { Meta, StoryObj } from '@storybook/vue3'
import PynAddPerson from '../components/PynAddPerson.vue'

const meta: Meta<typeof PynAddPerson> = {
  title: 'Repository/PynAddPerson',
  component: PynAddPerson,
  args: { roles: ['reader', 'writer', 'maintainer', 'admin'] },
}
export default meta
type Story = StoryObj<typeof PynAddPerson>

export const Default: Story = {}
export const UserExists: Story = { args: { error: 'that user name is already taken' } }
