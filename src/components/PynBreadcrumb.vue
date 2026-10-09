<script setup lang="ts">
import styles from '../styles/PynBreadcrumb.module.scss'
import type { Crumb } from '../types/tree.types'

defineProps<{ crumbs: Crumb[] }>()
</script>

<template>
  <nav :class="styles.nav" aria-label="Path">
    <ol :class="styles.list">
      <li v-for="(crumb, i) in crumbs" :key="i" :class="styles.item">
        <a v-if="crumb.href" :href="crumb.href" :class="styles.link">{{ crumb.label }}</a>
        <span v-else :class="styles.current" aria-current="page">{{ crumb.label }}</span>
      </li>
    </ol>
  </nav>
</template>
