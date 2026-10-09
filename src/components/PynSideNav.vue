<script setup lang="ts">
import PynIcon from './PynIcon.vue'
import styles from '../styles/PynSideNav.module.scss'
import { repoPath, repoSlug } from '../state/repo.state'
import type { NavItem } from '../state/shell.state'
import type { RepoInfo } from '../types/repo.types'

defineProps<{
  account: string
  items: NavItem[]
  current: string
  repos: RepoInfo[]
  currentRepo?: string
}>()
</script>

<template>
  <nav :class="styles.side" aria-label="Main">
    <button
      type="button"
      :class="styles.switcher"
      disabled
      title="Organizations are not available yet"
    >
      <span :class="styles.avatar">{{ account.slice(0, 1).toUpperCase() }}</span>
      <span :class="styles.account">{{ account }}</span>
      <PynIcon name="chevron" />
    </button>
    <ul :class="styles.list">
      <li v-for="item in items" :key="item.id">
        <a
          :href="item.href"
          :class="styles.link"
          :aria-current="item.id === current ? 'page' : undefined"
        >
          <PynIcon :name="item.icon" />{{ item.label }}
        </a>
      </li>
    </ul>
    <h2 :class="styles.heading">Your repositories</h2>
    <ul v-if="repos.length" :class="styles.list">
      <li v-for="repo in repos" :key="repoSlug(repo)">
        <a
          :href="repoPath(repo)"
          :class="styles.link"
          :aria-current="repoSlug(repo) === currentRepo ? 'true' : undefined"
        >
          <PynIcon name="repo" /><span :class="styles.repo">{{ repoSlug(repo) }}</span>
        </a>
      </li>
    </ul>
    <p v-else :class="styles.empty">None yet.</p>
  </nav>
</template>
