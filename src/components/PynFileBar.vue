<script setup lang="ts">
import PynLockBadge from './PynLockBadge.vue'
import PynModeChip from './PynModeChip.vue'
import styles from '../styles/PynFileBar.module.scss'
import { baseName, contentUrl, historyLink } from '../state/blob.state'
import { formatDateTime } from '../state/datetime.state'
import { formatAgo } from '../state/tree.state'
import type { TreeEntry } from '../types/tree.types'

defineProps<{
  entry: TreeEntry
  owner: string
  name: string
  me?: string
  now?: Date
}>()
</script>

<template>
  <div :class="styles.bar">
    <div :class="styles.top">
      <span :class="styles.file">{{ baseName(entry.path) }}</span>
      <PynModeChip :mode="entry.mode" />
      <PynLockBadge v-if="entry.mode === 'exclusive'" :lock="entry.lock" :me="me" :now="now" />
      <span :class="styles.actions">
        <a :href="historyLink({ owner, name }, entry.path)" :class="styles.action">History</a>
        <a
          v-if="entry.last_change"
          :href="contentUrl({ owner, name }, entry.path)"
          :download="baseName(entry.path)"
          :class="styles.action"
          >Download</a
        >
      </span>
    </div>
    <p v-if="entry.last_change" :class="styles.change">
      <span :class="styles.rev" :title="`Revision ${entry.last_change.id}`"
        >r{{ entry.last_change.id }}</span
      >
      <span :class="styles.message">{{ entry.last_change.message || '(no message)' }}</span>
      <span :class="styles.meta">
        {{ entry.last_change.author }} ·
        <span :title="formatDateTime(entry.last_change.created_at)">{{
          formatAgo(entry.last_change.created_at, now ?? new Date())
        }}</span>
      </span>
    </p>
    <p v-else :class="styles.change">
      <span :class="styles.meta">No revision yet</span>
    </p>
  </div>
</template>
