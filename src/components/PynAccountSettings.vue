<script setup lang="ts">
import styles from '../styles/PynAccountSettings.module.scss'
import type { NavItem } from '../state/shell.state'

defineProps<{ items: Pick<NavItem, 'id' | 'label' | 'href'>[]; current: string }>()
</script>

<template>
  <div :class="styles.layout">
    <nav :class="styles.nav" aria-label="Account settings">
      <a
        v-for="item in items"
        :key="item.id"
        :href="item.href"
        :class="styles.link"
        :aria-current="item.id === current ? 'page' : undefined"
        >{{ item.label }}</a
      >
    </nav>
    <div :class="styles.body"><slot /></div>
  </div>
</template>
