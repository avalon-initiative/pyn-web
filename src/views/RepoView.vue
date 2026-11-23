<script setup lang="ts">
import {
  PynRepoShell,
  PynOwnerFrozenNotice,
  PynRepoNotFound,
  orgPath,
  repoShellTabs,
  PynViewError,
  PynViewSummary,
  PynViewAction,
  PynBranchPicker,
  PynBranchCompare,
  blobPath,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../api/client'
import { getOrg, getOwnerFreeze } from '../api/orgs'
import { compareBranch, getRepo, listBranches, listLocks, repoMe } from '../api/repos'
import { useAction } from '../state/action.state'
import { useBranch, useBranches } from '../state/branch.state'
import { compareChanges, useBranchCompare } from '../state/compare.state'
import { repoKey, sessionKey } from '../state/context.state'
import { useOwnerFreeze } from '../state/freeze.state'
import { withPolicyTabs } from '../state/repo-tabs.state'
import { isRepoOwner } from '../state/repo-access.state'
import { lockHolders, railBranches } from '../state/repo-rail.state'
import type { LockInfo, OrgInfo } from '@avalon-initiative/pyn-common-ui'
import type { RepoInfo } from '@avalon-initiative/pyn-common-ui'

const route = useRoute()
const router = useRouter()
const { user, admin } = inject(sessionKey)!
const owner = computed(() => String(route.params.owner))
const name = computed(() => String(route.params.name))
const section = computed(() => {
  const [first, ...rest] = route.path.split('/').slice(3)
  return first === 'tree' || first === 'blob' ? '' : [first, ...rest].filter(Boolean).join('/')
})

const { freeze, frozen } = useOwnerFreeze(owner, getOwnerFreeze)
const target = computed(() => ({ owner: owner.value, name: name.value }))
const repo = ref<RepoInfo | null>(null)
const permissions = ref<string[]>([])
const org = ref<OrgInfo | null>(null)
const locks = ref<LockInfo[] | null>(null)
const notFound = ref(false)
const { error, attempt } = useAction()
const branch = useBranch()
const picker = useBranches(target, listBranches)
const compareHead = computed(() =>
  picker.loaded.value &&
  !picker.unknown.value &&
  branch.value &&
  branch.value !== picker.defaultName.value
    ? branch.value
    : undefined,
)
const compare = useBranchCompare(target, compareHead, compareBranch)

// A deleted path is not on the branch, so it opens on the default branch.
function openChange(path: string) {
  const change = compare.result.value?.changes.find((c) => c.path === path)
  const on = change?.kind === 'deleted' ? undefined : compareHead.value
  void router.push(blobPath(target.value, path, on))
}

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

// One request per repository visit; the Code and Locks pages refresh the list after that.
async function loadLocks() {
  const t = target.value
  try {
    const list = await listLocks(t)
    if (t === target.value && locks.value === null) locks.value = list
  } catch {
    // The count is a convenience: no strip and no badge without it.
  }
}

watch(
  target,
  () => {
    repo.value = null
    locks.value = null
    load().then(() => {
      if (permissions.value.includes('read')) void loadLocks()
    })
  },
  { immediate: true },
)

const branches = computed(() =>
  railBranches(
    picker.options.value,
    compare.result.value && compareHead.value
      ? {
          head: compareHead.value,
          ahead: compare.result.value.ahead,
          behind: compare.result.value.behind,
        }
      : null,
  ),
)

provide(repoKey, {
  target,
  repo,
  permissions,
  org,
  frozen,
  locks,
  branches,
  reload: async () => void (await load()),
})

const tabs = computed(() =>
  withPolicyTabs(
    repoShellTabs(permissions.value, isRepoOwner(owner.value, user.value, org.value), {
      serverAdmin: admin.value,
      insights: false,
    }),
  ),
)
const ownerHref = computed(() => (org.value ? orgPath(owner.value) : `/${owner.value}`))
</script>

<template>
  <PynRepoNotFound v-if="notFound" :slug="`${owner}/${name}`" />
  <PynViewError v-else-if="error">{{ error }}</PynViewError>
  <template v-else-if="repo">
    <PynOwnerFrozenNotice v-if="freeze" :freeze="freeze" />
    <PynRepoShell
      :owner="repo.owner"
      :name="repo.name"
      :visibility="repo.visibility"
      :tabs="permissions.includes('read') ? tabs : undefined"
      :current="section"
      :branch="branch"
      :owner-href="ownerHref"
      :locked-count="locks?.length ?? 0"
      :lock-holders="lockHolders(locks ?? [])"
      :max-tabs="5"
      hide-path
    >
      <template #actions>
        <span data-lease>{{ repo.lease_hours }}h leases</span>
        <span v-if="repo.role" data-role>your role: {{ repo.role }}</span>
        <span v-if="org" data-org>organization</span>
        <PynBranchPicker
          v-if="permissions.includes('read')"
          :branches="picker.options.value"
          :current="picker.current.value"
          :loading="picker.loading.value"
          :error="picker.error.value || undefined"
          @select="picker.select"
        />
      </template>
      <PynViewSummary v-if="!permissions.includes('read')">
        You have no role in this repository. Ask an admin to add you or send an invitation.
      </PynViewSummary>
      <PynViewSummary v-else-if="picker.unknown.value" data-unknown-branch>
        This repository has no branch named {{ route.query.branch }}. It may have been deleted or
        renamed.
        <PynViewAction :href="route.path" primary>Back to the default branch</PynViewAction>
      </PynViewSummary>
      <template v-else-if="!picker.pending.value">
        <PynBranchCompare
          v-if="
            compareHead && (compare.result.value || compare.loading.value || compare.error.value)
          "
          :base="compare.result.value?.base ?? picker.defaultName.value"
          :head="compare.result.value?.head ?? compareHead"
          :status="compare.result.value?.status ?? 'identical'"
          :ahead="compare.result.value?.ahead ?? 0"
          :behind="compare.result.value?.behind ?? 0"
          :counts-capped="compare.result.value?.counts_capped"
          :max-commits="compare.result.value?.max_commits"
          :changes="compare.result.value ? compareChanges(compare.result.value) : []"
          :truncated="compare.result.value?.truncated"
          :loading="compare.loading.value"
          :error="compare.error.value || undefined"
          @select="openChange"
        />
        <RouterView />
      </template>
    </PynRepoShell>
  </template>
</template>
