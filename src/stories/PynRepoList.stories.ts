import type { Meta, StoryObj } from '@storybook/vue3'
import PynRepoList from '../components/PynRepoList.vue'

const meta: Meta<typeof PynRepoList> = { title: 'Repositories/PynRepoList', component: PynRepoList }
export default meta
type Story = StoryObj<typeof PynRepoList>

const repo = (owner: string, name: string, role: string, visibility = 'private') => ({
  owner,
  name,
  visibility: visibility as 'private' | 'public',
  max_locks_per_user: 10,
  max_locks_set_by_policy: false,
  lease_hours: 8,
  created_at: '2026-10-01T09:00:00Z',
  role,
})

export const Repositories: Story = {
  args: {
    repos: [
      repo('alice', 'game', 'admin'),
      repo('alice', 'tools', 'admin', 'public'),
      repo('bob', 'assets', 'writer'),
    ],
  },
}
export const Empty: Story = { args: { repos: [] } }
