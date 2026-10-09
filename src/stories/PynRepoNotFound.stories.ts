import type { Meta, StoryObj } from '@storybook/vue3'
import PynRepoNotFound from '../components/PynRepoNotFound.vue'

const meta: Meta<typeof PynRepoNotFound> = {
  title: 'Repositories/PynRepoNotFound',
  component: PynRepoNotFound,
}
export default meta

export const Default: StoryObj<typeof PynRepoNotFound> = { args: { slug: 'bob/secret' } }
