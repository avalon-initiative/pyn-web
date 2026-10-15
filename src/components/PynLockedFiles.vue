<script setup lang="ts">
import { PynIcon, PynLockBadge, repoPath } from '@avalon-initiative/pyn-common-ui'
import styles from '../styles/PynLockedFiles.module.scss'
import type { LockInfo } from '../types/lock.types'

defineProps<{ locks: LockInfo[]; owner: string; name: string; me?: string; now?: Date }>()
</script>

<template>
  <section :class="styles.card" aria-labelledby="locked-title">
    <div :class="styles.head">
      <h2 id="locked-title" :class="styles.title">Locked files</h2>
      <a :href="repoPath({ owner, name }, 'locks')" :class="styles.more">View all</a>
    </div>
    <ul v-if="locks.length" :class="styles.list">
      <li v-for="lock in locks" :key="lock.path" :class="styles.item">
        <PynIcon name="file" :class="styles.icon" />
        <span :class="styles.path">{{ lock.path }}</span>
        <PynLockBadge :lock="lock" :me="me" :now="now" />
      </li>
    </ul>
    <p v-else :class="styles.empty">No files are locked.</p>
  </section>
</template>
