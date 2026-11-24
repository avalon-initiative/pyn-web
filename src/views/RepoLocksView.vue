<script setup lang="ts">
import { PynLocksPage, repoPath } from '@avalon-initiative/pyn-common-ui'
import type { LockInfo, LockListItem, LockView } from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { forceUnlock, listLocks, releaseLock } from '../api/repos'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { canWrite } from '../state/freeze.state'
import { releaseEach } from '../state/my-locks.state'

const VIEWS: LockView[] = ['all', 'mine', 'expiring', 'stale']

const { target, permissions, frozen, locks: shared } = inject(repoKey)!
const me = inject(sessionKey)!.user
const route = useRoute()
const locks = ref<LockInfo[]>([])
const query = ref('')
const failures = ref<Record<string, string>>({})
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
    failures.value = {}
    await releaseLock(target.value, lock.path)
    locks.value = shared.value = await listLocks(target.value)
  })

const releaseMany = (picked: LockListItem[]) =>
  attempt(async () => {
    const failed = await releaseEach(picked, (l) => releaseLock(target.value, l.path))
    failures.value = Object.fromEntries(failed.map((f) => [f.lock.path, f.message]))
    locks.value = shared.value = await listLocks(target.value)
  })

const rows = computed<LockListItem[]>(() =>
  locks.value.map((l) => (failures.value[l.path] ? { ...l, error: failures.value[l.path] } : l)),
)

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
    :locks="rows"
    bulk
    :me="me || undefined"
    :view="view"
    :hrefs="hrefs"
    :can-force="canForce"
    :busy="busy"
    :loading="loading"
    :error="error || undefined"
    @release="release"
    @release-many="releaseMany"
    @force-release="forceRelease"
  />
</template>
