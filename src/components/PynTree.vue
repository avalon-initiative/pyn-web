<script setup lang="ts">
import PynIcon from './PynIcon.vue'
import PynLockBadge from './PynLockBadge.vue'
import PynModeChip from './PynModeChip.vue'
import styles from '../styles/PynTree.module.scss'
import { formatAgo, treePath } from '../state/tree.state'
import { splitPath } from '../state/files.state'
import type { TreeEntry } from '../types/tree.types'

defineProps<{
  entries: TreeEntry[]
  owner: string
  name: string
  me?: string
  now?: Date
}>()
</script>

<template>
  <table v-if="entries.length" :class="styles.table">
    <thead :class="styles.head">
      <tr>
        <th scope="col">Name</th>
        <th scope="col">Last change</th>
        <th scope="col">Status</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="e in entries" :key="e.path" :class="styles.row" :data-kind="e.kind">
        <td :class="styles.name">
          <PynIcon :name="e.kind" :class="styles.icon" />
          <a v-if="e.kind === 'folder'" :href="treePath({ owner, name }, e.path)">{{ e.name }}</a>
          <span v-else>{{ e.name }}</span>
        </td>
        <td :class="styles.change">
          <template v-if="e.last_change">
            <span :class="styles.message">{{ e.last_change.message || '(no message)' }}</span>
            <span :class="styles.meta">
              <span
                :class="styles.rev"
                :title="`Revision ${e.last_change.id} of ${e.last_change.path}`"
                >r{{ e.last_change.id }}</span
              >
              {{ e.last_change.author }} ·
              {{ formatAgo(e.last_change.created_at, now ?? new Date())
              }}<template v-if="e.kind === 'folder'">
                · {{ splitPath(e.last_change.path).name }}</template
              >
            </span>
          </template>
          <span v-else :class="styles.meta">No revision yet</span>
        </td>
        <td :class="styles.status">
          <PynModeChip :mode="e.mode" />
          <PynLockBadge v-if="e.lock" :lock="e.lock" :me="me" :now="now" />
        </td>
      </tr>
    </tbody>
  </table>
  <p v-else :class="styles.empty">This folder is empty.</p>
</template>
