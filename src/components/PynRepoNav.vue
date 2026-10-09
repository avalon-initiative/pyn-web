<script setup lang="ts">
import styles from '../styles/PynRepoNav.module.scss'
import { repoPath } from '../state/repo.state'
import type { RepoTab } from '../state/repo.state'

defineProps<{ owner: string; name: string; tabs: RepoTab[]; current: string }>()
</script>

<template>
  <nav :class="styles.nav" aria-label="Repository">
    <a
      v-for="tab in tabs"
      :key="tab.section"
      :href="repoPath({ owner, name }, tab.section)"
      :class="styles.tab"
      :aria-current="tab.section === current ? 'page' : undefined"
      >{{ tab.label }}</a
    >
  </nav>
</template>
