import type { Meta, StoryObj } from '@storybook/vue3'
import PynRepoLanding from '../components/PynRepoLanding.vue'
import { folderListing, now, repo, rootListing, summary } from './landing-data'

const meta: Meta<typeof PynRepoLanding> = {
  title: 'Browse/PynRepoLanding',
  component: PynRepoLanding,
  parameters: { layout: 'fullscreen' },
  args: { repo, path: '', listing: rootListing, summary, me: 'jamie', now },
}
export default meta
type Story = StoryObj<typeof PynRepoLanding>

/** The repository root: file table and right rail. */
export const Root: Story = {}
export const Folder: Story = { args: { path: 'Content/Levels', listing: folderListing } }
export const EmptyRepository: Story = {
  args: {
    listing: { path: '', entries: [] },
    summary: {
      ...summary,
      files: 0,
      exclusive_files: 0,
      shared_files: 0,
      updated_at: null,
      locks: [],
      activity: [],
    },
  },
}
export const MissingFolder: Story = { args: { path: 'Content/Gone', listing: null, missing: true } }
export const Loading: Story = { args: { listing: null, summary: null } }
