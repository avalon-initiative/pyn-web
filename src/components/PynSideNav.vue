<script setup lang="ts">
import PynIcon from './PynIcon.vue'
import styles from '../styles/PynSideNav.module.scss'
import { orgPath } from '../state/org.state'
import { repoPath, repoSlug } from '../state/repo.state'
import type { NavItem } from '../state/shell.state'
import type { OrgInfo } from '../types/org.types'
import type { RepoInfo } from '../types/repo.types'

defineProps<{
  account: string
  items: NavItem[]
  current: string
  repos: RepoInfo[]
  currentRepo?: string
  orgs?: OrgInfo[]
  currentOrg?: string
}>()
</script>

<template>
  <nav :class="styles.side" aria-label="Main">
    <p :class="styles.switcher">
      <span :class="styles.avatar">{{ account.slice(0, 1).toUpperCase() }}</span>
      <span :class="styles.account">{{ account }}</span>
    </p>
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
    <template v-if="orgs?.length">
      <h2 :class="styles.heading">Your organizations</h2>
      <ul :class="styles.list">
        <li v-for="org in orgs" :key="org.name">
          <a
            :href="orgPath(org.name)"
            :class="styles.link"
            :aria-current="org.name === currentOrg ? 'true' : undefined"
          >
            <PynIcon name="user" /><span :class="styles.repo">{{ org.name }}</span>
          </a>
        </li>
      </ul>
    </template>
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
