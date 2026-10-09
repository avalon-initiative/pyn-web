import type { Meta, StoryObj } from '@storybook/vue3'
import PynCodeView from '../components/PynCodeView.vue'
import { codeText } from './file-data'

const meta: Meta<typeof PynCodeView> = {
  title: 'File/PynCodeView',
  component: PynCodeView,
  args: { text: codeText, language: 'typescript' },
}
export default meta
type Story = StoryObj<typeof PynCodeView>

export const TypeScript: Story = {}
export const PlainText: Story = { args: { language: null } }
