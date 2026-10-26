<script setup lang="ts">
import {
  PynRepoHeader,
  PynRepoNotFound,
  repoTabs,
  PynViewError,
  PynViewSummary,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '../api/client'
import { getOrg } from '../api/orgs'
import { getRepo, repoMe } from '../api/repos'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { canOpenSettings, isRepoOwner } from '../state/repo-access.state'
import type { OrgInfo } from '@avalon-initiative/pyn-common-ui'
import type { RepoInfo } from '@avalon-initiative/pyn-common-ui'

const route = useRoute()
const user = inject(sessionKey)!.user
const owner = computed(() => String(route.params.owner))
const name = computed(() => String(route.params.name))
const section = computed(() => {
  const s = String(route.path.split('/')[3] ?? '')
  return s === 'tree' ? '' : s
})

const target = computed(() => ({ owner: owner.value, name: name.value }))
const repo = ref<RepoInfo | null>(null)
const permissions = ref<string[]>([])
const org = ref<OrgInfo | null>(null)
const notFound = ref(false)
const { error, attempt } = useAction()

async function load() {
  const t = target.value
  notFound.value = false
  return attempt(async () => {
    try {
      const [info, me, owningOrg] = await Promise.all([
        getRepo(t),
        repoMe(t),
        getOrg(t.owner).catch(() => null),
      ])
      repo.value = info
      permissions.value = me.permissions
      org.value = owningOrg
    } catch (e) {
      if (e instanceof ApiError && e.code === 'repo_not_found') notFound.value = true
      else throw e
    }
  })
}

watch(
  target,
  () => {
    repo.value = null
    load()
  },
  { immediate: true },
)

provide(repoKey, {
  target,
  repo,
  permissions,
  org,
  reload: async () => void (await load()),
})

const tabs = computed(() =>
  repoTabs(
    permissions.value,
    canOpenSettings(permissions.value, isRepoOwner(owner.value, user.value, org.value)),
  ),
)
</script>

<template>
  <PynRepoNotFound v-if="notFound" :slug="`${owner}/${name}`" />
  <PynViewError v-else-if="error">{{ error }}</PynViewError>
  <template v-else-if="repo">
    <PynRepoHeader
      :owner="repo.owner"
      :name="repo.name"
      :visibility="repo.visibility"
      :lease-hours="repo.lease_hours"
      :role="repo.role"
      :org-owned="org !== null"
      :tabs="permissions.includes('read') ? tabs : undefined"
      :current="section"
    />
    <PynViewSummary v-if="!permissions.includes('read')">
      You have no role in this repository. Ask an admin to add you or send an invitation.
    </PynViewSummary>
    <RouterView v-else />
  </template>
</template>
