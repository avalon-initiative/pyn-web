<script setup lang="ts">
import styles from '../styles/PynRepoList.module.scss'
import { repoPath, repoSlug } from '../state/repo.state'
import type { RepoInfo } from '../types/repo.types'

defineProps<{ repos: RepoInfo[] }>()
</script>

<template>
  <ul v-if="repos.length" :class="styles.list">
    <li v-for="repo in repos" :key="repoSlug(repo)" :class="styles.item">
      <a :href="repoPath(repo)" :class="styles.link">
        <span :class="styles.owner">{{ repo.owner }}/</span>{{ repo.name }}
      </a>
      <span :class="styles.meta">
        <span :class="styles.pill">{{ repo.visibility }}</span>
        <span v-if="repo.role" :class="styles.pill" data-role>{{ repo.role }}</span>
        <span>{{ repo.lease_hours }}h leases</span>
      </span>
    </li>
  </ul>
  <p v-else :class="styles.empty">
    You are not in any repository yet. <a href="/_/new">Create one</a>.
  </p>
</template>
