<script setup lang="ts">
import { PynEmptyState, PynLocksPage, lockRowFromMine } from '@avalon-initiative/pyn-common-ui'
import type { LockListItem, MyLock } from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { listMyLocks, releaseLock } from '../api/repos'
import { useAction } from '../state/action.state'
import { sessionKey } from '../state/context.state'
import { LOCKS_HINT } from '../state/empty.state'
import { releaseEach } from '../state/my-locks.state'
import { refreshTopBar } from '../state/top-bar.state'
import type { ReleaseFailure } from '@avalon-initiative/pyn-common-ui'

const me = inject(sessionKey)!.user
const locks = ref<MyLock[]>([])
const failures = ref<ReleaseFailure[]>([])
const query = ref('')
const loaded = ref(false)
const { busy, error, attempt } = useAction()

const rows = computed<LockListItem[]>(() =>
  locks.value.map((l) => {
    const failed = failures.value.find(
      (f) => f.lock.owner === l.owner && f.lock.name === l.name && f.lock.path === l.path,
    )
    return { ...lockRowFromMine(l, me.value), ...(failed ? { error: failed.message } : {}) }
  }),
)

const refresh = async () => {
  locks.value = await listMyLocks()
}

const release = (row: LockListItem) =>
  attempt(async () => {
    const lock = locks.value.find((l) => `${l.owner}/${l.name}` === row.repo && l.path === row.path)
    if (!lock) return
    failures.value = await releaseEach([lock], (l) => releaseLock(l, l.path))
    await refresh()
    void refreshTopBar()
  })

onMounted(async () => {
  await attempt(refresh)
  loaded.value = true
})
</script>

<template>
  <PynEmptyState
    v-if="loaded && !locks.length && !error"
    title="You hold no locks"
    :description="LOCKS_HINT"
    primary-label="Browse repositories"
    primary-href="/"
  />
  <PynLocksPage
    v-else
    v-model:query="query"
    title="Your locks"
    :locks="rows"
    :me="me"
    :busy="busy"
    :loading="!loaded"
    :error="error || undefined"
    @release="release"
  />
</template>
