<script setup lang="ts">
import styles from '../styles/PynOrgHeader.module.scss'
import { formatDate } from '../state/datetime.state'
import { orgPath, orgTabs } from '../state/org.state'
import type { OrgRole } from '../types/org.types'

defineProps<{ name: string; createdAt: string; role?: OrgRole | null; current?: string }>()
</script>

<template>
  <header :class="styles.header">
    <h1 :class="styles.title">
      {{ name }}
      <span :class="styles.chip" data-kind>organization</span>
    </h1>
    <p :class="styles.meta">
      created {{ formatDate(createdAt) }}<template v-if="role"> · your role: {{ role }}</template>
    </p>
    <nav :class="styles.nav" aria-label="Organization">
      <a
        v-for="tab in orgTabs(role)"
        :key="tab.section"
        :href="orgPath(name, tab.section)"
        :class="styles.tab"
        :aria-current="tab.section === (current ?? '') ? 'page' : undefined"
        >{{ tab.label }}</a
      >
    </nav>
  </header>
</template>
