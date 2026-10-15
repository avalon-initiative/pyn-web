<script setup lang="ts">
import { PynMyLocks, PynViewHeader } from '@avalon-initiative/pyn-common-ui'
import { onMounted, ref } from 'vue'
import { listMyLocks, releaseLock } from '../api/repos'
import { useAction } from '../state/action.state'
import { releaseEach } from '../state/my-locks.state'
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
  })

const releaseAll = () =>
  attempt(async () => {
    failures.value = await releaseEach(locks.value, (l) => releaseLock(l, l.path))
    await refresh()
  })

onMounted(async () => {
  await attempt(refresh)
  loaded.value = true
})
</script>

<template>
  <PynViewHeader title="Your active locks" />
  <PynMyLocks
    v-if="loaded"
    :locks="locks"
    :failures="failures"
    :busy="busy"
    :error="error"
    @release="release"
    @release-all="releaseAll"
  />
</template>
