<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listMyLocks, releaseLock } from '../api/repos'
import PynMyLocks from '../components/PynMyLocks.vue'
import { useAction } from '../state/action.state'
import { releaseEach } from '../state/my-locks.state'
import styles from '../styles/View.module.scss'
import type { MyLock, ReleaseFailure } from '../types/lock.types'

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
  <header :class="styles.header">
    <h1 :class="styles.title">Your active locks</h1>
  </header>
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
