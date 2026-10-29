<script setup lang="ts">
import { PynLocks } from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { forceUnlock, listLocks } from '../api/repos'
import { useAction } from '../state/action.state'
import { repoKey } from '../state/context.state'
import { canWrite } from '../state/freeze.state'
import type { LockInfo } from '@avalon-initiative/pyn-common-ui'

const { target, permissions, frozen } = inject(repoKey)!
const locks = ref<LockInfo[]>([])
const { busy, error, attempt } = useAction()
const canForce = computed(() => canWrite(permissions.value.includes('force_unlock'), frozen.value))

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
