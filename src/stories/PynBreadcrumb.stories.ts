import type { Meta, StoryObj } from '@storybook/vue3'
import PynBreadcrumb from '../components/PynBreadcrumb.vue'
import { breadcrumbs } from '../state/tree.state'

const meta: Meta<typeof PynBreadcrumb> = { title: 'Browse/PynBreadcrumb', component: PynBreadcrumb }
export default meta
type Story = StoryObj<typeof PynBreadcrumb>
const repo = { owner: 'acme', name: 'castle-quest' }

export const Root: Story = { args: { crumbs: breadcrumbs(repo, '') } }
export const Nested: Story = { args: { crumbs: breadcrumbs(repo, 'Content/Levels/Dungeon') } }
