import type { Meta, StoryObj } from '@storybook/vue3'
import PynRepoHeader from '../components/PynRepoHeader.vue'
import { repoTabs } from '../state/repo.state'

const meta: Meta<typeof PynRepoHeader> = {
  title: 'Repositories/PynRepoHeader',
  component: PynRepoHeader,
  args: { owner: 'alice', name: 'castle-quest', visibility: 'private', leaseHours: 24 },
}
export default meta
type Story = StoryObj<typeof PynRepoHeader>

const admin = ['read', 'view_audit', 'manage_users', 'manage_roles']
export const Admin: Story = { args: { role: 'admin', tabs: repoTabs(admin, true), current: '' } }
export const OrganizationOwned: Story = {
  args: { owner: 'studio', role: 'admin', orgOwned: true, tabs: repoTabs(admin, true) },
}
export const Reader: Story = {
  args: { visibility: 'public', role: 'reader', tabs: repoTabs(['read'], false), current: 'locks' },
}
export const NoAccess: Story = { args: { visibility: 'public' } }
