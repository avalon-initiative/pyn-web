<script setup lang="ts">
import { PynPullRequestList, PynViewNotice, repoPath } from '@avalon-initiative/pyn-common-ui'
import type { PullRequestSummary } from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listPulls } from '../api/pulls'
import { useAction } from '../state/action.state'
import { repoKey } from '../state/context.state'
import {
  PULL_PAGE_SIZE,
  pullListView,
  toPullSummary,
  withPullStatus,
  type PullStatus,
} from '../state/pull.state'

// The list filters in the browser, so it reads at most this many pages of the newest.
const MAX_PAGES = 10

const { target } = inject(repoKey)!
const route = useRoute()
const router = useRouter()
const all = ref<PullRequestSummary[]>([])
const capped = ref(false)
const loading = ref(true)
const page = ref(1)
const query = ref(typeof route.query.q === 'string' ? route.query.q : 'is:open')
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
    for (let i = 0; i < MAX_PAGES; i++) {
      const res = await listPulls(t, { before, limit: 100 })
      out.push(...res.pulls.map((p) => toPullSummary(p, repoPath(t, `pulls/${p.number}`))))
      if (res.next_before == null) {
        capped.value = false
        break
      }
      before = res.next_before
      capped.value = true
    }
    all.value = out
  })
  loading.value = false
}

const setStatus = (status: PullStatus) => (query.value = withPullStatus(query.value, status))

watch(query, (q) => {
  page.value = 1
  void router.replace({ query: { ...route.query, q: q === 'is:open' ? undefined : q } })
})

onMounted(load)
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
    @update:status="setStatus"
    @update:page="page = $event"
  />
</template>
