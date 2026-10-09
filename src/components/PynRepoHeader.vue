<script setup lang="ts">
import PynRepoNav from './PynRepoNav.vue'
import styles from '../styles/PynRepoHeader.module.scss'
import { orgPath } from '../state/org.state'
import type { RepoTab } from '../state/repo.state'
import type { Visibility } from '../types/repo.types'

defineProps<{
  owner: string
  name: string
  visibility: Visibility
  leaseHours: number
  role?: string | null
  /** True when the owner is an organization. */
  orgOwned?: boolean
  /** Omitted when the viewer has no access, which hides the tab row. */
  tabs?: RepoTab[]
  current?: string
}>()
</script>

<template>
  <header :class="styles.header">
    <h1 :class="styles.title">
      <a v-if="orgOwned" :href="orgPath(owner)" :class="styles.owner">{{ owner }}/</a>
      <span v-else :class="styles.owner">{{ owner }}/</span>{{ name }}
      <span :class="styles.chip" data-visibility>{{ visibility }}</span>
      <span v-if="orgOwned" :class="styles.chip" data-org>organization</span>
    </h1>
    <p :class="styles.meta">
      {{ leaseHours }}h leases<template v-if="role"> · your role: {{ role }}</template>
    </p>
    <PynRepoNav v-if="tabs" :owner="owner" :name="name" :tabs="tabs" :current="current ?? ''" />
  </header>
</template>
