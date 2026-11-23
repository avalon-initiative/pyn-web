<script setup lang="ts">
import {
  PynAttention,
  PynDashboard,
  PynDashboardCard,
  PynDashboardFirstRun,
  PynDashboardOrganizations,
  PynDashboardRepositories,
  PynRecentItems,
  PynViewAction,
  PynViewError,
  PynViewHeader,
  sortOrgs,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, watch } from 'vue'
import { acceptInvitation, listMyInvitations, listMyOrgs } from '../api/orgs'
import { listMyLocks, listRepos } from '../api/repos'
import { listNotices } from '../api/two-factor'
import { useAction } from '../state/action.state'
import { sessionKey } from '../state/context.state'
import { useCard } from '../state/dashboard.state'
import { clearRecent, recentItems, setRecentUser } from '../state/recent.state'
import { sortRepos } from '../state/repo.state'
import { refreshInvitations, refreshOrgs, refreshRepos } from '../state/session-data.state'
import { SECURITY_PATH } from '../state/two-factor.state'
import type { AttentionNotice, MyLock, OrgInfo, RepoInfo } from '@avalon-initiative/pyn-common-ui'
import type { OrgInvitation } from '@avalon-initiative/pyn-common-ui'

const session = inject(sessionKey)
const expired = () => session?.expire()
const { error: acceptError, attempt } = useAction()

const repos = useCard<RepoInfo[]>(async () => sortRepos(await listRepos()), [], expired)
const orgs = useCard<OrgInfo[]>(async () => sortOrgs(await listMyOrgs()), [], expired)
const locks = useCard<MyLock[]>(listMyLocks, [], expired)
const invitations = useCard<OrgInvitation[]>(listMyInvitations, [], expired)
const notices = useCard<AttentionNotice[]>(
  async () => (await listNotices()).map((n) => ({ id: n.id, text: n.detail, href: SECURITY_PATH })),
  [],
  expired,
)
const attention = [locks, invitations, notices]

const attentionLoading = computed(() => attention.some((c) => c.loading.value))
const attentionError = computed(() => attention.find((c) => c.error.value)?.error.value ?? '')
const loadAttention = () => Promise.all(attention.map((c) => c.load()))
const loaded = computed(() => !repos.loading.value && !orgs.loading.value)
const firstRun = computed(
  () =>
    loaded.value &&
    !repos.error.value &&
    !orgs.error.value &&
    !repos.data.value.length &&
    !orgs.data.value.length,
)

async function accept(org: string, event: MouseEvent) {
  event.preventDefault()
  await attempt(async () => {
    await acceptInvitation(org)
  })
  await Promise.all([
    loadAttention(),
    orgs.load(),
    repos.load(),
    refreshInvitations(),
    refreshOrgs(),
    refreshRepos(),
  ])
}

watch(
  () => session?.user.value,
  (name) => setRecentUser(name ?? ''),
  { immediate: true },
)
onMounted(() => void Promise.all([repos.load(), orgs.load(), loadAttention()]))
</script>

<template>
  <PynDashboardFirstRun v-if="firstRun" />
  <PynDashboard v-else>
    <template #header>
      <PynViewHeader title="Dashboard">
        <PynViewAction href="/_/explore">Explore</PynViewAction>
        <PynViewAction href="/_/new" primary>New repository</PynViewAction>
      </PynViewHeader>
    </template>
    <template #main>
      <PynDashboardRepositories
        :repos="repos.data.value"
        :loading="repos.loading.value"
        :error="repos.error.value"
        see-all-href="/_/repos"
        @retry="repos.load"
      />
      <PynDashboardCard heading="Recently opened">
        <PynRecentItems :items="recentItems" clearable @clear="clearRecent" />
      </PynDashboardCard>
    </template>
    <template #side>
      <PynViewError v-if="acceptError" dismissible @dismiss="acceptError = ''">{{
        acceptError
      }}</PynViewError>
      <PynDashboardCard
        heading="Needs your attention"
        :loading="attentionLoading"
        :error="attentionError"
        retryable
        @retry="loadAttention"
      >
        <PynAttention
          :locks="locks.data.value"
          :invitations="invitations.data.value"
          :notices="notices.data.value"
          @accept="accept"
        />
      </PynDashboardCard>
      <PynDashboardOrganizations
        :orgs="orgs.data.value"
        :loading="orgs.loading.value"
        :error="orgs.error.value"
        @retry="orgs.load"
      />
    </template>
  </PynDashboard>
</template>
