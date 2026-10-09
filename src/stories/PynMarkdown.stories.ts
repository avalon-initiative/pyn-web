import type { Meta, StoryObj } from '@storybook/vue3'
import PynMarkdown from '../components/PynMarkdown.vue'
import { readmeText } from './file-data'

const meta: Meta<typeof PynMarkdown> = {
  title: 'File/PynMarkdown',
  component: PynMarkdown,
  args: { source: readmeText, owner: 'acme', name: 'castle-quest', dir: '' },
}
export default meta
type Story = StoryObj<typeof PynMarkdown>

export const Document: Story = {}

export const HeadingAnchors: Story = {
  args: { source: '[Jump to Setup](#setup)\n\n## Usage\n\nText.\n\n## Setup\n\n## Setup\n' },
}

export const ExternalImages: Story = {
  args: {
    source:
      'Repository image: ![Logo](logo.png)\n\nExternal: ![Build status](https://example.com/badge.svg)\n\nInline data: ![Pixel](data:image/gif;base64,R0lGODlhAQABAAAAACw=)\n',
  },
}
