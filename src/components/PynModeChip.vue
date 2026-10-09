<script setup lang="ts">
import styles from '../styles/PynModeChip.module.scss'
import type { Mode } from '../types/lock.types'

defineProps<{ mode: Mode }>()
</script>

<template>
  <span :class="[styles.chip, styles[mode]]" :data-mode="mode">{{
    mode === 'exclusive' ? 'Exclusive' : 'Shared'
  }}</span>
</template>
