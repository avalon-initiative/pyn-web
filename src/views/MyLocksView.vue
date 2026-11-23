<script setup lang="ts">
import {
  PynEmptyState,
  PynMyLocks,
  PynViewHeader,
  PynLoading,
} from '@avalon-initiative/pyn-common-ui'
import { onMounted, ref } from 'vue'
import { listMyLocks, releaseLock } from '../api/repos'
import { useAction } from '../state/action.state'
import { LOCKS_HINT } from '../state/empty.state'
import { releaseEach } from '../state/my-locks.state'
import { refreshTopBar } from '../state/top-bar.state'
import type { MyLock, ReleaseFailure } from '@avalon-initiative/pyn-common-ui'

const locks = ref<MyLock[]>([])
const failures = ref<ReleaseFailure[]>([])
const loaded = ref(false)
const { busy, error, attempt } = useAction()

const refresh = async () => {
  locks.value = await listMyLocks()
}

const release = (lock: MyLock) =>
  attempt(async () => {
    failures.value = await releaseEach([lock], (l) => releaseLock(l, l.path))
    await refresh()
    void refreshTopBar()
  })

const releaseAll = () =>
  attempt(async () => {
    failures.value = await releaseEach(locks.value, (l) => releaseLock(l, l.path))
    await refresh()
    void refreshTopBar()
  })

onMounted(async () => {
  await attempt(refresh)
  loaded.value = true
})
</script>

<template>
  <PynViewHeader title="Your active locks" />
  <PynLoading v-if="!loaded" />
  <template v-else-if="!locks.length && !error">
    <PynEmptyState
      title="You hold no locks"
      :description="LOCKS_HINT"
      primary-label="Browse repositories"
      primary-href="/"
    />
  </template>
  <PynMyLocks
    v-else-if="loaded"
    :locks="locks"
    :failures="failures"
    :busy="busy"
    :error="error"
    @release="release"
    @release-all="releaseAll"
  />
</template>
