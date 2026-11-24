<script setup lang="ts">
import { inject } from 'vue'
import { orgKey } from '../state/context.state'
import OwnerUsagePanel from './OwnerUsagePanel.vue'
import OwnerView from './OwnerView.vue'

const { org } = inject(orgKey)!
</script>

<template>
  <OwnerUsagePanel v-if="org" />
  <OwnerView v-else />
</template>
