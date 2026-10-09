<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { forceUnlock, listLocks } from '../api/repos'
import PynLocks from '../components/PynLocks.vue'
import { useAction } from '../state/action.state'
import { repoKey } from '../state/context.state'
import type { LockInfo } from '../types/lock.types'

const { target, permissions } = inject(repoKey)!
const locks = ref<LockInfo[]>([])
const { busy, error, attempt } = useAction()
const canForce = computed(() => permissions.value.includes('force_unlock'))

const load = () =>
  attempt(async () => {
    locks.value = await listLocks(target.value)
  })

const unlock = (f: { path: string; reason: string }) =>
  attempt(async () => {
    await forceUnlock(target.value, f.path, f.reason)
    locks.value = await listLocks(target.value)
  })

onMounted(load)
</script>

<template>
  <PynLocks
    :locks="locks"
    :can-force="canForce"
    :busy="busy"
    :error="error"
    @force-unlock="unlock"
  />
</template>
