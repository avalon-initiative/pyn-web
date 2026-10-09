<script setup lang="ts">
import PynIcon from './PynIcon.vue'
import styles from '../styles/PynBranchBar.module.scss'
import { formatDateTime } from '../state/datetime.state'
import { formatAgo } from '../state/tree.state'

defineProps<{
  branch: string
  files: number
  updatedAt?: string | null
  now?: Date
}>()
</script>

<template>
  <div :class="styles.bar">
    <span :class="styles.branch"><PynIcon name="branch" :class="styles.icon" />{{ branch }}</span>
    <span :class="styles.meta">{{ files }} {{ files === 1 ? 'file' : 'files' }}</span>
    <span v-if="updatedAt" :class="styles.updated" :title="formatDateTime(updatedAt)"
      >Last revision {{ formatAgo(updatedAt, now ?? new Date()) }}</span
    >
    <span v-else :class="styles.updated">No revisions yet</span>
  </div>
</template>
