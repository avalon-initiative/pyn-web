<script setup lang="ts">
import { PynLocksPage, repoPath } from '@avalon-initiative/pyn-common-ui'
import type { LockInfo, LockView } from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { forceUnlock, listLocks, releaseLock } from '../api/repos'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { canWrite } from '../state/freeze.state'

const VIEWS: LockView[] = ['all', 'mine', 'expiring', 'stale']

const { target, permissions, frozen, locks: shared } = inject(repoKey)!
const me = inject(sessionKey)!.user
const route = useRoute()
const locks = ref<LockInfo[]>([])
const query = ref('')
const loading = ref(true)
const { busy, error, attempt } = useAction()
const canForce = computed(() => canWrite(permissions.value.includes('force_unlock'), frozen.value))
const view = computed(() => VIEWS.find((v) => v === route.query.view) ?? 'all')
const hrefs = computed(() => {
  const base = repoPath(target.value, 'locks')
  return Object.fromEntries(VIEWS.map((v) => [v, v === 'all' ? base : `${base}?view=${v}`]))
})

const load = () =>
  attempt(async () => {
    locks.value = shared.value = await listLocks(target.value)
  })

const release = (lock: LockInfo) =>
  attempt(async () => {
    await releaseLock(target.value, lock.path)
    locks.value = shared.value = await listLocks(target.value)
  })

const forceRelease = (f: { lock: LockInfo; reason: string }) =>
  attempt(async () => {
    await forceUnlock(target.value, f.lock.path, f.reason)
    locks.value = shared.value = await listLocks(target.value)
  })

onMounted(async () => {
  await load()
  loading.value = false
})
</script>

<template>
  <PynLocksPage
    v-model:query="query"
    :locks="locks"
    :me="me || undefined"
    :view="view"
    :hrefs="hrefs"
    :can-force="canForce"
    :busy="busy"
    :loading="loading"
    :error="error || undefined"
    @release="release"
    @force-release="forceRelease"
  />
</template>
