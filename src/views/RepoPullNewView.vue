<script setup lang="ts">
import {
  PynDiffStat,
  PynLoading,
  PynPullRequestForm,
  PynViewAction,
  PynViewNotice,
  PynViewSummary,
  repoPath,
} from '@avalon-initiative/pyn-common-ui'
import type { NewPullRequest } from '@avalon-initiative/pyn-common-ui'
import { computed, inject, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, describeError } from '../api/client'
import { compareDiff, createPull, listPulls } from '../api/pulls'
import { useAction } from '../state/action.state'
import { repoKey } from '../state/context.state'
import { diffCounts } from '../state/pull.state'

const { target, branches, branchesLoading, branchesError, reloadPulls } = inject(repoKey)!
const route = useRoute()
const router = useRouter()
const queryOf = (v: unknown) => (typeof v === 'string' ? v : '')
const base = ref(queryOf(route.query.base))
const head = ref(queryOf(route.query.head))
const create = useAction()
const exists = ref(false)
const existing = ref<{ number: number; href: string } | null>(null)
const defaultBranch = computed(() => branches.value.find((b) => b.isDefault)?.name ?? '')
const baseName = computed(() => base.value || defaultBranch.value)
const pullsHref = computed(() => repoPath(target.value, 'pulls'))

const counts = ref<ReturnType<typeof diffCounts> | null>(null)
const compareError = ref('')
let seq = 0

// Counts only: the files are shown once the pull request exists.
watch(
  [target, base, head],
  async () => {
    const mine = ++seq
    counts.value = null
    compareError.value = ''
    if (!head.value || head.value === baseName.value) return
    try {
      const d = await compareDiff(target.value, {
        base: base.value || undefined,
        head: head.value,
        merge_base: true,
      })
      if (mine === seq) counts.value = diffCounts(d)
    } catch (e) {
      if (mine === seq) compareError.value = describeError(e)
    }
  },
  { immediate: true },
)
const comparing = computed(
  () => !!head.value && head.value !== baseName.value && !counts.value && !compareError.value,
)

// The server names no pull request in `pull_request_exists`, so the open one is looked up.
async function findExisting(p: NewPullRequest) {
  const t = target.value
  try {
    const { pulls } = await listPulls(t, {
      state: 'open',
      head: p.head,
      base: p.base || defaultBranch.value || undefined,
      limit: 1,
    })
    const n = pulls[0]?.number
    if (n != null) existing.value = { number: n, href: repoPath(t, `pulls/${n}`) }
  } catch {
    // The notice still explains the refusal without the link.
  }
}

async function submit(p: NewPullRequest) {
  exists.value = false
  existing.value = null
  const t = target.value
  let refused: unknown = null
  await create.attempt(async () => {
    try {
      const made = await createPull(t, {
        title: p.title,
        body: p.body,
        draft: p.draft,
        base: p.base || undefined,
        head: p.head,
      })
      void reloadPulls?.()
      await router.push(repoPath(t, `pulls/${made.number}`))
    } catch (e) {
      refused = e
      throw e
    }
  })
  if (refused instanceof ApiError && refused.code === 'pull_request_exists') {
    exists.value = true
    await findExisting(p)
  }
}
</script>

<template>
  <PynViewNotice v-if="exists" tone="warning" title="A pull request already exists">
    An open pull request already proposes these branches.
    <PynViewAction v-if="existing" :href="existing.href">
      View pull request #{{ existing.number }}
    </PynViewAction>
  </PynViewNotice>
  <PynPullRequestForm
    v-model:base="base"
    v-model:head="head"
    :branches="branches"
    :branches-loading="branchesLoading"
    :branches-error="branchesError || undefined"
    :busy="create.busy.value"
    :error="exists ? undefined : create.error.value || undefined"
    :cancel-href="pullsHref"
    @submit="submit"
  >
    <template #compare>
      <PynLoading v-if="comparing" variant="inline" label="Comparing branches" />
      <PynViewSummary v-else-if="compareError">{{ compareError }}</PynViewSummary>
      <PynViewSummary v-else-if="counts">
        <template v-if="counts.files">
          {{ counts.files }} {{ counts.files === 1 ? 'file' : 'files' }} changed{{
            counts.truncated ? ' or more' : ''
          }}
          <PynDiffStat :additions="counts.additions" :deletions="counts.deletions" />
        </template>
        <template v-else>These branches have no changes between them.</template>
      </PynViewSummary>
    </template>
  </PynPullRequestForm>
</template>
