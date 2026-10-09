import type { Meta, StoryObj } from '@storybook/vue3'
import PynFileList from '../components/PynFileList.vue'
import PynRepoHeader from '../components/PynRepoHeader.vue'
import PynShell from '../components/PynShell.vue'
import PynSideNav from '../components/PynSideNav.vue'
import PynTopBar from '../components/PynTopBar.vue'
import { repoTabs } from '../state/repo.state'
import { mainNav } from '../state/shell.state'
import { sampleRepos } from './shell-data'

const meta: Meta<typeof PynShell> = {
  title: 'Shell/PynShell',
  component: PynShell,
  parameters: { layout: 'fullscreen' },
}
export default meta

const now = new Date('2026-10-08T12:00:00Z')
const rows = [
  {
    path: 'Config/DefaultGame.ini',
    mode: 'exclusive' as const,
    revision: 12,
    lock: {
      path: 'Config/DefaultGame.ini',
      owner: 'bob',
      acquired_at: '2026-10-08T09:00:00Z',
      expires_at: '2026-10-08T15:42:00Z',
    },
  },
  { path: 'Source/Player.cpp', mode: 'shared' as const, revision: 9 },
]

/** Repository page mockup: top bar, sidebar, header and file list. */
export const RepositoryPage: StoryObj<typeof PynShell> = {
  render: () => ({
    components: { PynShell, PynTopBar, PynSideNav, PynRepoHeader, PynFileList },
    setup: () => ({ sampleRepos, mainNav, rows, now, tabs: repoTabs(['read'], false) }),
    template: `
      <PynShell>
        <template #top><PynTopBar user="alice" :repos="['alice/castle-quest']" theme="system" /></template>
        <template #side><PynSideNav account="alice" :items="mainNav" current="" :repos="sampleRepos" current-repo="alice/castle-quest" /></template>
        <PynRepoHeader owner="alice" name="castle-quest" visibility="private" :lease-hours="24" role="admin" :tabs="tabs" current="" />
        <PynFileList :rows="rows" me="alice" :now="now" />
      </PynShell>`,
  }),
}
