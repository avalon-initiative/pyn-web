<script setup lang="ts">
import styles from '../styles/PynActivity.module.scss'
import { formatDateTime } from '../state/datetime.state'
import { activityVerb, formatAgo } from '../state/tree.state'
import type { ActivityEntry } from '../types/tree.types'

defineProps<{ entries: ActivityEntry[]; now?: Date }>()
</script>

<template>
  <section :class="styles.card" aria-labelledby="activity-title">
    <h2 id="activity-title" :class="styles.title">Recent activity</h2>
    <ul v-if="entries.length" :class="styles.list">
      <li v-for="e in entries" :key="e.id" :class="styles.item">
        <span :class="styles.avatar" aria-hidden="true">{{
          e.actor.slice(0, 1).toUpperCase()
        }}</span>
        <div>
          <p :class="styles.text">
            <strong>{{ e.actor }}</strong> {{ activityVerb(e) }}
            <span v-if="e.path" :class="styles.path">{{ e.path }}</span>
          </p>
          <time :class="styles.time" :datetime="e.at" :title="formatDateTime(e.at)">{{
            formatAgo(e.at, now ?? new Date())
          }}</time>
        </div>
      </li>
    </ul>
    <p v-else :class="styles.empty">No activity yet.</p>
  </section>
</template>
