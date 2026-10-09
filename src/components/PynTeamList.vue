<script setup lang="ts">
import styles from '../styles/PynTeamList.module.scss'
import { formatDate } from '../state/datetime.state'
import { teamPath } from '../state/team.state'
import type { TeamInfo } from '../types/team.types'

defineProps<{ org: string; teams: TeamInfo[] }>()
</script>

<template>
  <ul v-if="teams.length" :class="styles.list">
    <li v-for="t in teams" :key="t.slug" :class="styles.item">
      <span :class="styles.who">
        <a :href="teamPath(org, t.slug)" :class="styles.link">{{ t.name }}</a>
        <span v-if="t.name !== t.slug" :class="styles.slug">{{ t.slug }}</span>
        <span v-if="t.description" :class="styles.description">{{ t.description }}</span>
      </span>
      <span :class="styles.meta">
        <span data-members>{{ t.members.length }} members</span>
        <span data-repos>{{ t.repos.length }} repositories</span>
        <span>created {{ formatDate(t.created_at) }}</span>
      </span>
    </li>
  </ul>
  <p v-else :class="styles.empty">This organization has no teams yet.</p>
</template>
