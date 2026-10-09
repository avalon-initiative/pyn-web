import type { Meta, StoryObj } from '@storybook/vue3'
import PynRepoForm from '../components/PynRepoForm.vue'

const meta: Meta<typeof PynRepoForm> = { title: 'Repositories/PynRepoForm', component: PynRepoForm }
export default meta
type Story = StoryObj<typeof PynRepoForm>

export const Create: Story = { args: { owner: 'alice' } }
export const OwnerPicker: Story = {
  args: { owner: 'studio', owners: ['alice', 'studio', 'modding-club'] },
}
export const Edit: Story = {
  args: { owner: 'alice', repo: { name: 'game', visibility: 'public', lease_hours: 24 } },
}
export const EditWithLimit: Story = {
  args: {
    owner: 'alice',
    repo: { name: 'game', visibility: 'public', lease_hours: 24, max_locks_per_user_setting: 5 },
    effectiveMaxLocks: 5,
  },
}
export const EditDefaultLimit: Story = {
  args: {
    owner: 'alice',
    repo: { name: 'game', visibility: 'public', lease_hours: 24, max_locks_per_user_setting: null },
    effectiveMaxLocks: 10,
  },
}
export const LimitSetByPolicy: Story = {
  args: {
    owner: 'alice',
    repo: {
      name: 'game',
      visibility: 'public',
      lease_hours: 24,
      max_locks_per_user_setting: 5,
      max_locks_set_by_policy: true,
    },
    effectiveMaxLocks: 3,
  },
}
export const NameTaken: Story = {
  args: { owner: 'alice', error: 'A repository with that name already exists for this owner.' },
}
