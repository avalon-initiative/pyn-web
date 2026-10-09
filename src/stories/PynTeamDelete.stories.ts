import type { Meta, StoryObj } from '@storybook/vue3'
import PynTeamDelete from '../components/PynTeamDelete.vue'

const meta: Meta<typeof PynTeamDelete> = {
  title: 'Organizations/PynTeamDelete',
  component: PynTeamDelete,
  args: { slug: 'artists' },
}
export default meta
type Story = StoryObj<typeof PynTeamDelete>

export const Default: Story = {}
export const Failed: Story = { args: { error: 'That team does not exist.' } }
