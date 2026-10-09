import type { Meta, StoryObj } from '@storybook/vue3'
import PynOrgList from '../components/PynOrgList.vue'
import { orgs } from './org-data'

const meta: Meta<typeof PynOrgList> = { title: 'Organizations/PynOrgList', component: PynOrgList }
export default meta
type Story = StoryObj<typeof PynOrgList>

export const Default: Story = { args: { orgs } }
export const Empty: Story = { args: { orgs: [] } }
