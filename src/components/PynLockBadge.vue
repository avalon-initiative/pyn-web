<script setup lang="ts">
import { computed } from 'vue'
import PynLockIcon from './PynLockIcon.vue'
import styles from '../styles/PynLockBadge.module.scss'
import { formatLease, lockState } from '../state/lease.state'
import type { LockInfo } from '../types/lock.types'

const props = defineProps<{
  lock?: LockInfo | null
  /** The signed-in user, so their own locks read as "You". */
  me?: string
  /** Injected for deterministic stories and tests; defaults to the current time. */
  now?: Date
}>()

const at = computed(() => props.now ?? new Date())
const state = computed(() => lockState(props.lock, props.me, at.value))
const label = computed(() => {
  if (state.value === 'available') return 'Available'
  return state.value === 'mine' ? 'You' : props.lock!.owner
})
const lease = computed(() =>
  state.value === 'available' ? '' : formatLease(props.lock!.expires_at, at.value),
)
</script>

<template>
  <span :class="[styles.badge, styles[state]]" :data-state="state">
    <PynLockIcon :class="styles.icon" :open="state === 'available'" />
    <span>{{ label }}</span>
    <span v-if="lease" :class="styles.lease">{{ lease }}</span>
  </span>
</template>
