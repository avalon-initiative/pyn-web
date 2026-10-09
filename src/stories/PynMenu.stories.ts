import type { Meta, StoryObj } from '@storybook/vue3'
import PynMenu from '../components/PynMenu.vue'

const meta: Meta<typeof PynMenu> = {
  title: 'Shell/PynMenu',
  component: PynMenu,
  render: (args) => ({
    components: { PynMenu },
    setup: () => ({ args }),
    template: '<div style="min-height: 14rem"><PynMenu v-bind="args">Menu</PynMenu></div>',
  }),
}
export default meta
type Story = StoryObj<typeof PynMenu>

export const Links: Story = {
  args: { label: 'Create', items: [{ id: 'new', label: 'New repository', href: '/_/new' }] },
}
export const Choices: Story = {
  args: {
    label: 'Theme',
    items: [
      { id: 'light', label: 'Light', checked: false },
      { id: 'dark', label: 'Dark', checked: true },
    ],
  },
}
