<script setup lang="ts">
import styles from '../styles/PynFileList.module.scss'
import PynLockBadge from './PynLockBadge.vue'
import { splitPath } from '../state/files.state'
import type { FileRow } from '../types/lock.types'

defineProps<{
  rows: FileRow[]
  me?: string
  now?: Date
}>()
</script>

<template>
  <ul v-if="rows.length" :class="styles.list">
    <li v-for="row in rows" :key="row.path" :class="styles.row">
      <span :class="styles.path"
        ><span :class="styles.dir">{{ splitPath(row.path).dir }}</span
        ><span :class="styles.name">{{ splitPath(row.path).name }}</span></span
      >
      <span :class="styles.meta">
        {{ row.mode }}<template v-if="row.revision != null"> · r{{ row.revision }}</template>
      </span>
      <PynLockBadge v-if="row.mode === 'exclusive'" :lock="row.lock" :me="me" :now="now" />
    </li>
  </ul>
  <p v-else :class="styles.empty">No files.</p>
</template>
