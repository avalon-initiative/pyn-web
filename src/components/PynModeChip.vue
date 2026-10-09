<script setup lang="ts">
import styles from '../styles/PynModeChip.module.scss'
import type { TreeMode } from '../types/tree.types'

const LABELS = { shared: 'Shared', exclusive: 'Exclusive', mixed: 'Mixed' } as const

defineProps<{ mode: TreeMode }>()
</script>

<template>
  <span :class="[styles.chip, styles[mode]]" :data-mode="mode">{{ LABELS[mode] }}</span>
</template>
