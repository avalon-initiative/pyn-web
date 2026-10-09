<script setup lang="ts">
import styles from '../styles/PynOrgList.module.scss'
import { formatDate } from '../state/datetime.state'
import { orgPath } from '../state/org.state'
import type { OrgInfo } from '../types/org.types'

defineProps<{ orgs: OrgInfo[] }>()
</script>

<template>
  <ul v-if="orgs.length" :class="styles.list">
    <li v-for="org in orgs" :key="org.name" :class="styles.item">
      <a :href="orgPath(org.name)" :class="styles.link">{{ org.name }}</a>
      <span :class="styles.meta">
        <span v-if="org.role" :class="styles.pill" data-role>{{ org.role }}</span>
        <span>created {{ formatDate(org.created_at) }}</span>
      </span>
    </li>
  </ul>
  <p v-else :class="styles.empty">
    You are not in any organization yet. <a href="/_/new-org">Create one</a>.
  </p>
</template>
