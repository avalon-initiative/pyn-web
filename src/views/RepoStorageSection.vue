<script setup lang="ts">
import {
  PynStorageCapForm,
  PynUsageBreakdown,
  PynViewError,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject } from 'vue'
import { getRepoBreakdown, getRepoUsage, setRepoStorageCap } from '../api/usage'
import { repoKey, sessionKey } from '../state/context.state'
import { canSeeBreakdown, canSetCap } from '../state/repo-access.state'
import { useRepoStorage } from '../state/usage.state'

const props = defineProps<{ owner: boolean }>()
const { target, permissions, frozen } = inject(repoKey)!
const operator = inject(sessionKey)!.admin
const withBreakdown = computed(() => canSeeBreakdown(permissions.value, operator.value))
const s = useRepoStorage(target, withBreakdown, {
  usage: getRepoUsage,
  breakdown: getRepoBreakdown,
  setCap: setRepoStorageCap,
})
</script>

<template>
  <PynViewStack v-if="s.loaded.value">
    <PynViewError v-if="s.loadError.value">{{ s.loadError.value }}</PynViewError>
    <template v-else>
      <PynUsageBreakdown v-if="s.breakdown.value" :breakdown="s.breakdown.value" />
      <PynStorageCapForm
        v-if="canSetCap(props.owner, operator) && s.usage.value"
        :cap="s.usage.value.storage_cap"
        :readonly="frozen"
        :busy="s.busy.value"
        :error="s.error.value"
        @save="s.save"
        @clear="s.clear"
      />
    </template>
  </PynViewStack>
</template>
