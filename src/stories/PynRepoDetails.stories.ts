import type { Meta, StoryObj } from '@storybook/vue3'
import PynRepoDetails from '../components/PynRepoDetails.vue'
import { now, repo, summary } from './landing-data'

const meta: Meta<typeof PynRepoDetails> = {
  title: 'Browse/PynRepoDetails',
  component: PynRepoDetails,
  args: {
    owner: repo.owner,
    visibility: repo.visibility,
    leaseHours: repo.lease_hours,
    createdAt: repo.created_at,
    updatedAt: summary.updated_at,
    files: summary.files,
    exclusiveFiles: summary.exclusive_files,
    sharedFiles: summary.shared_files,
    now,
  },
}
export default meta
type Story = StoryObj<typeof PynRepoDetails>

export const Default: Story = {}
export const Empty: Story = {
  args: { files: 0, exclusiveFiles: 0, sharedFiles: 0, updatedAt: null },
}
