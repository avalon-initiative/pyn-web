import type { Meta, StoryObj } from '@storybook/vue3'
import PynSideNav from '../components/PynSideNav.vue'
import { mainNav } from '../state/shell.state'
import { sampleRepos } from './shell-data'

const meta: Meta<typeof PynSideNav> = {
  title: 'Shell/PynSideNav',
  component: PynSideNav,
  args: { account: 'alice', items: mainNav, current: 'repositories', repos: sampleRepos },
}
export default meta
type Story = StoryObj<typeof PynSideNav>

export const Default: Story = {}
export const InRepository: Story = { args: { current: '', currentRepo: 'alice/castle-quest' } }
export const NoRepositories: Story = { args: { repos: [] } }
