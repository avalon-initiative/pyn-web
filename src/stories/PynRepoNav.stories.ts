import type { Meta, StoryObj } from '@storybook/vue3'
import PynRepoNav from '../components/PynRepoNav.vue'
import { repoTabs } from '../state/repo.state'

const meta: Meta<typeof PynRepoNav> = { title: 'Repositories/PynRepoNav', component: PynRepoNav }
export default meta
type Story = StoryObj<typeof PynRepoNav>

const admin = ['read', 'view_audit', 'manage_users', 'manage_roles']

export const OwnerAdmin: Story = {
  args: { owner: 'alice', name: 'game', tabs: repoTabs(admin, true), current: 'audit' },
}
export const Reader: Story = {
  args: { owner: 'alice', name: 'game', tabs: repoTabs(['read'], false), current: '' },
}
