import type { Meta, StoryObj } from '@storybook/vue3'
import PynSearch from '../components/PynSearch.vue'

const meta: Meta<typeof PynSearch> = {
  title: 'Shell/PynSearch',
  component: PynSearch,
  args: { options: ['acme/castle-quest', 'acme/core-engine', 'alice/game'] },
}
export default meta
export const Default: StoryObj<typeof PynSearch> = {}
