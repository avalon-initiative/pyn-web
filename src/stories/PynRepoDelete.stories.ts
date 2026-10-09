import type { Meta, StoryObj } from '@storybook/vue3'
import PynRepoDelete from '../components/PynRepoDelete.vue'

const meta: Meta<typeof PynRepoDelete> = {
  title: 'Repositories/PynRepoDelete',
  component: PynRepoDelete,
}
export default meta
type Story = StoryObj<typeof PynRepoDelete>

export const Default: Story = { args: { slug: 'alice/game' } }
export const Refused: Story = {
  args: { slug: 'alice/game', error: 'Only the repository owner, as an admin, can do that.' },
}
