import type { Meta, StoryObj } from '@storybook/vue3'
import PynModeChip from '../components/PynModeChip.vue'

const meta: Meta<typeof PynModeChip> = { title: 'Locks/PynModeChip', component: PynModeChip }
export default meta
type Story = StoryObj<typeof PynModeChip>

export const Shared: Story = { args: { mode: 'shared' } }
export const Exclusive: Story = { args: { mode: 'exclusive' } }
