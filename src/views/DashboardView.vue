<script setup lang="ts">
import {
  PynDashboard,
  PynDashboardActivity,
  PynDashboardFirstRun,
  PynDashboardLocks,
  PynDashboardNotices,
  sortOrgs,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted } from 'vue'
import { listMyOrgs } from '../api/orgs'
import { listMyLocks, listRepos } from '../api/repos'
import { sessionKey } from '../state/context.state'
import { useCard } from '../state/dashboard.state'
import { sortRepos } from '../state/repo.state'
import type { MyLock, OrgInfo, RepoInfo } from '@avalon-initiative/pyn-common-ui'

const session = inject(sessionKey)
const expired = () => session?.expire()

const repos = useCard<RepoInfo[]>(async () => sortRepos(await listRepos()), [], expired)
const orgs = useCard<OrgInfo[]>(async () => sortOrgs(await listMyOrgs()), [], expired)
const locks = useCard<MyLock[]>(listMyLocks, [], expired)
const now = new Date()
const loaded = computed(() => !repos.loading.value && !orgs.loading.value)
const firstRun = computed(
  () =>
    loaded.value &&
    !repos.error.value &&
    !orgs.error.value &&
    !repos.data.value.length &&
    !orgs.data.value.length,
)

onMounted(() => void Promise.all([repos.load(), orgs.load(), locks.load()]))
</script>

<template>
  <PynDashboardFirstRun v-if="firstRun" />
  <PynDashboard v-else>
    <template #main>
      <PynDashboardLocks
        :locks="locks.data.value"
        :now="now"
        :loading="locks.loading.value"
        :error="locks.error.value"
        view-all-href="/_/locks"
        @retry="locks.load"
      />
      <PynDashboardLocks
        kind="expiring"
        :locks="locks.data.value"
        :now="now"
        :loading="locks.loading.value"
        :error="locks.error.value"
        view-all-href="/_/locks"
        @retry="locks.load"
      />
      <PynDashboardActivity :entries="[]" :now="now" />
    </template>
    <template #side>
      <PynDashboardNotices :notices="[]" :now="now" />
    </template>
  </PynDashboard>
</template>
