import type { Meta, StoryObj } from '@storybook/vue3'
import PynAccountSettings from '../components/PynAccountSettings.vue'
import { accountNav } from '../state/shell.state'

const meta: Meta<typeof PynAccountSettings> = {
  title: 'Shell/PynAccountSettings',
  component: PynAccountSettings,
  args: { items: accountNav, current: 'keys' },
  render: (args) => ({
    components: { PynAccountSettings },
    setup: () => ({ args }),
    template: '<PynAccountSettings v-bind="args"><p>Page content</p></PynAccountSettings>',
  }),
}
export default meta
export const Default: StoryObj<typeof PynAccountSettings> = {}
