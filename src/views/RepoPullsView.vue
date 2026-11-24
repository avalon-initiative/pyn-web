<script setup lang="ts">
import { PynPullRequestList, PynViewNotice, repoPath } from '@avalon-initiative/pyn-common-ui'
import type { PullRequestSummary } from '@avalon-initiative/pyn-common-ui'
import { computed, inject, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listPulls } from '../api/pulls'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { canWrite } from '../state/freeze.state'
import {
  PULL_PAGE_SIZE,
  pullListView,
  toPullSummary,
  withPullStatus,
  type PullStatus,
} from '../state/pull.state'

// The list filters in the browser, so it reads at most this many pages of the newest.
const MAX_PAGES = 10

const { target, permissions, frozen } = inject(repoKey)!
const signedIn = inject(sessionKey)!.user
const newHref = computed(() =>
  signedIn.value && canWrite(permissions.value.includes('checkin'), frozen.value)
    ? repoPath(target.value, 'pulls/new')
    : undefined,
)
const route = useRoute()
const router = useRouter()
const all = ref<PullRequestSummary[]>([])
const capped = ref(false)
const loading = ref(true)
const page = ref(1)
const queryOf = (q: unknown) => (typeof q === 'string' ? q : 'is:open')
const query = ref(queryOf(route.query.q))
const { error, attempt } = useAction()

const view = computed(() => pullListView(all.value, query.value))
const rows = computed(() =>
  view.value.rows.slice((page.value - 1) * PULL_PAGE_SIZE, page.value * PULL_PAGE_SIZE),
)

async function load() {
  const t = target.value
  await attempt(async () => {
    const out: PullRequestSummary[] = []
    let before: number | undefined
    let more = false
    try {
      for (let i = 0; i < MAX_PAGES; i++) {
        const res = await listPulls(t, { before, limit: 100 })
        out.push(...res.pulls.map((p) => toPullSummary(p, repoPath(t, `pulls/${p.number}`))))
        more = res.next_before != null
        if (!more) break
        before = res.next_before!
      }
    } catch (e) {
      if (t === target.value) throw e
    }
    if (t !== target.value) return
    all.value = out
    capped.value = more
  })
  if (t === target.value) loading.value = false
}

const setStatus = (status: PullStatus) => (query.value = withPullStatus(query.value, status))

watch(query, (q) => {
  page.value = 1
  if (q !== queryOf(route.query.q))
    void router.replace({ query: { ...route.query, q: q === 'is:open' ? undefined : q } })
})
watch(
  () => route.query.q,
  (q) => (query.value = queryOf(q)),
)
watch(
  target,
  () => {
    all.value = []
    capped.value = false
    loading.value = true
    void load()
  },
  { immediate: true },
)
</script>

<template>
  <PynViewNotice v-if="capped" tone="info">
    Showing the newest {{ all.length }} pull requests.
  </PynViewNotice>
  <PynPullRequestList
    v-model:query="query"
    :pulls="rows"
    :count="view.rows.length"
    :counts="view.counts"
    :status="view.status"
    :page="page"
    :page-size="PULL_PAGE_SIZE"
    :loading="loading"
    :error="error || undefined"
    :filtered="query.trim() !== `is:${view.status}`"
    :new-href="newHref"
    @update:status="setStatus"
    @update:page="page = $event"
  />
</template>
