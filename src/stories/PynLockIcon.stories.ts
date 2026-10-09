import type { Meta, StoryObj } from '@storybook/vue3'
import PynLockIcon from '../components/PynLockIcon.vue'

const meta: Meta<typeof PynLockIcon> = {
  title: 'Locks/PynLockIcon',
  component: PynLockIcon,
  render: (args) => ({
    components: { PynLockIcon },
    setup: () => ({ args }),
    template: '<span style="font-size: 2rem"><PynLockIcon v-bind="args" /></span>',
  }),
}
export default meta
type Story = StoryObj<typeof PynLockIcon>

export const Locked: Story = {}
export const Open: Story = { args: { open: true } }
