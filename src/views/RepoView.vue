<script setup lang="ts">
import {
  PynRepoShell,
  PynOwnerFrozenNotice,
  PynRepoNotFound,
  PynSignInPrompt,
  orgPath,
  repoShellTabs,
  PynViewError,
  PynViewSummary,
  PynViewAction,
  PynViewNotice,
  PynBranchCompare,
  blobPath,
  repoPath,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../api/client'
import { getOrg, getOrgProfile, getOwnerFreeze } from '../api/orgs'
import { getProfile } from '../api/profile'
import {
  compareBranch,
  deleteStar,
  deleteWatch,
  getRepo,
  listBranches,
  listLocks,
  putStar,
  putWatch,
  repoMe,
} from '../api/repos'
import { listPulls } from '../api/pulls'
import { listTags } from '../api/tags'
import { useAction } from '../state/action.state'
import { useBranch, useBranches } from '../state/branch.state'
import { compareChanges, useBranchCompare } from '../state/compare.state'
import { repoKey, sessionKey } from '../state/context.state'
import { useOwnerFreeze } from '../state/freeze.state'
import { refusedSignedOut } from '../state/public.state'
import { useRepoStar } from '../state/repo-star.state'
import { useRepoWatch } from '../state/repo-watch.state'
import { withPolicyTabs } from '../state/repo-tabs.state'
import { isRepoOwner } from '../state/repo-access.state'
import { lockHolders, railBranches } from '../state/repo-rail.state'
import { useTags } from '../state/tags.state'
import type { LockInfo, OrgInfo, RefKind, RepoFact } from '@avalon-initiative/pyn-common-ui'
import type { RepoDetails } from '../types/repo.types'

const route = useRoute()
const router = useRouter()
const { user, admin, requestSignIn } = inject(sessionKey)!
const owner = computed(() => String(route.params.owner))
const name = computed(() => String(route.params.name))
const section = computed(() => {
  const [first, ...rest] = route.path.split('/').slice(3)
  return first === 'tree' || first === 'blob' ? '' : [first, ...rest].filter(Boolean).join('/')
})

const landing = computed(() => route.name === 'files' || route.name === 'tree')
const signedOut = computed(() => !user.value)
const { freeze, frozen } = useOwnerFreeze(owner, (o) =>
  signedOut.value ? Promise.reject(new Error('signed out')) : getOwnerFreeze(o),
)
const target = computed(() => ({ owner: owner.value, name: name.value }))
const repo = ref<RepoDetails | null>(null)
const permissions = ref<string[]>([])
const org = ref<OrgInfo | null>(null)
const locks = ref<LockInfo[] | null>(null)
const openPulls = ref<number | undefined>(undefined)
const notFound = ref(false)
const ownerAvatar = ref<string | null>(null)
// A signed-out miss reads the same for a private and a missing repository.
const gated = ref(false)
const { error, attempt } = useAction()
const branch = useBranch()
const picker = useBranches(target, listBranches)
const tagList = useTags(target, listTags)
const tagsHref = computed(() => repoPath(target.value, 'tags'))

// Content is read by branch only, so a tag opens on the tags page.
function selectRef(name: string, kind: RefKind = 'branch') {
  if (kind === 'tag') return router.push({ path: tagsHref.value, query: { q: name } })
  return picker.select(name)
}
const compareHead = computed(() =>
  picker.loaded.value &&
  !picker.unknown.value &&
  branch.value &&
  branch.value !== picker.defaultName.value
    ? branch.value
    : undefined,
)
const star = useRepoStar(() => signedOut.value, requestSignIn, {
  put: () => putStar(target.value),
  remove: () => deleteStar(target.value),
})
const watching = useRepoWatch(() => signedOut.value, requestSignIn, {
  put: (level) => putWatch(target.value, level),
  remove: () => deleteWatch(target.value),
})
const social = computed(() => {
  const s = { watch: watching.button.value, star: star.button.value }
  return s.watch || s.star ? s : undefined
})
const compare = useBranchCompare(target, compareHead, compareBranch)
const showCompare = computed(
  () =>
    !!compareHead.value && !!(compare.result.value || compare.loading.value || compare.error.value),
)
const compareProps = computed(() => ({
  base: compare.result.value?.base ?? picker.defaultName.value,
  head: compare.result.value?.head ?? compareHead.value ?? '',
  status: compare.result.value?.status ?? ('identical' as const),
  ahead: compare.result.value?.ahead ?? 0,
  behind: compare.result.value?.behind ?? 0,
  countsCapped: compare.result.value?.counts_capped,
  maxCommits: compare.result.value?.max_commits,
  changes: compare.result.value ? compareChanges(compare.result.value) : [],
  truncated: compare.result.value?.truncated,
  loading: compare.loading.value,
  error: compare.error.value || undefined,
}))

// A deleted path is not on the branch, so it opens on the default branch.
function openChange(path: string) {
  const change = compare.result.value?.changes.find((c) => c.path === path)
  const on = change?.kind === 'deleted' ? undefined : compareHead.value
  void router.push(blobPath(target.value, path, on))
}

async function load() {
  const t = target.value
  notFound.value = false
  gated.value = false
  return attempt(async () => {
    try {
      const [info, me, owningOrg] = signedOut.value
        ? [await getRepo(t), { permissions: ['read'] }, null]
        : await Promise.all([getRepo(t), repoMe(t), getOrg(t.owner).catch(() => null)])
      repo.value = info
      star.sync(info)
      watching.sync(info)
      permissions.value = me.permissions
      org.value = owningOrg
    } catch (e) {
      if (signedOut.value && refusedSignedOut(e)) gated.value = true
      else if (e instanceof ApiError && e.code === 'repo_not_found') notFound.value = true
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

// One page of open pull requests; the tab shows at most a page's worth.
async function loadPullCount() {
  const t = target.value
  try {
    const { pulls } = await listPulls(t, { state: 'open', limit: 100 })
    if (t === target.value) openPulls.value = pulls.length
  } catch {
    // The count is a convenience: no badge without it.
  }
}

// The picture only decorates the header: without it initials stand in.
async function loadOwnerAvatar() {
  const t = target.value
  ownerAvatar.value = null
  try {
    const url = org.value
      ? (await getOrgProfile(t.owner))?.avatar_url
      : (await getProfile(t.owner))?.profile?.avatar_url
    if (t === target.value) ownerAvatar.value = url ?? null
  } catch {
    // Initials stand in.
  }
}

watch(
  target,
  () => {
    repo.value = null
    star.sync(null)
    watching.sync(null)
    locks.value = null
    openPulls.value = undefined
    load().then(() => {
      if (permissions.value.includes('read')) {
        void loadLocks()
        void loadPullCount()
      }
      if (repo.value) void loadOwnerAvatar()
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
  starCount: star.starCount,
  watcherCount: watching.watcherCount,
  branches,
  branchesLoading: picker.loading,
  branchesError: picker.error,
  selectBranch: selectRef,
  reloadBranches: picker.reload,
  tags: tagList.options,
  tagsLoading: tagList.loading,
  tagsError: tagList.error,
  tagsHref,
  reloadTags: tagList.reload,
  reloadPulls: loadPullCount,
  compare: { props: compareProps, show: showCompare, open: openChange },
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
const facts = computed<RepoFact[]>(() => {
  const r = repo.value
  if (!r) return []
  return [
    { value: `${r.lease_hours}h leases`, title: 'How long a lock lasts before it expires' },
    ...(r.role ? [{ label: 'your role', value: r.role }] : []),
    ...(org.value ? [{ value: 'organization' }] : []),
  ]
})
const ownerHref = computed(() => (org.value ? orgPath(owner.value) : `/${owner.value}`))
</script>

<template>
  <PynSignInPrompt
    v-if="gated"
    message="Sign in to see this repository, or check the address."
    sign-in-href="/"
  />
  <PynRepoNotFound v-else-if="notFound" :slug="`${owner}/${name}`" />
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
      :owner-avatar-url="ownerAvatar"
      :locked-count="locks?.length ?? 0"
      :pull-count="openPulls"
      :lock-holders="lockHolders(locks ?? [])"
      :max-tabs="5"
      :facts="facts"
      :hide-lock-strip="section === 'locks'"
      :social="social"
      @social="(kind) => (kind === 'star' ? star.toggle() : kind === 'watch' && watching.toggle())"
      @social-menu="(kind, id) => kind === 'watch' && watching.choose(id)"
    >
      <PynViewNotice v-if="star.error.value" tone="danger">{{ star.error.value }}</PynViewNotice>
      <PynViewNotice v-if="watching.error.value" tone="danger">{{
        watching.error.value
      }}</PynViewNotice>
      <PynSignInPrompt
        v-if="signedOut"
        message="Sign in to lock files, contribute or manage this repository."
        :heading-level="3"
        sign-in-href="/"
      />
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
          v-if="showCompare && !landing"
          v-bind="compareProps"
          @select="openChange"
        />
        <RouterView />
      </template>
    </PynRepoShell>
  </template>
</template>
