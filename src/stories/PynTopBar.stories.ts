import type { Meta, StoryObj } from '@storybook/vue3'
import PynTopBar from '../components/PynTopBar.vue'

const meta: Meta<typeof PynTopBar> = {
  title: 'Shell/PynTopBar',
  component: PynTopBar,
  args: { user: 'alice', repos: ['alice/game', 'alice/tools'], theme: 'system' },
}
export default meta
export const Default: StoryObj<typeof PynTopBar> = {}
