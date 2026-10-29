<script setup lang="ts">
import {
  PynStorageCapForm,
  PynUsageBreakdown,
  PynViewError,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject } from 'vue'
import { getRepoBreakdown, getRepoUsage, setRepoStorageCap } from '../api/usage'
import { repoKey } from '../state/context.state'
import { MANAGE_ROLES } from '../state/repo-access.state'
import { useRepoStorage } from '../state/usage.state'

const props = defineProps<{ owner: boolean }>()
const { target, permissions, frozen } = inject(repoKey)!
const isAdmin = computed(() => permissions.value.includes(MANAGE_ROLES))
const s = useRepoStorage(target, isAdmin, {
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
        v-if="props.owner && s.usage.value"
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
