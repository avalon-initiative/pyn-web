<script setup lang="ts">
import { computed } from 'vue'
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
    <svg
      :class="styles.icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <template v-if="state === 'available'">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 7.5-2" />
      </template>
      <template v-else>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </template>
    </svg>
    <span>{{ label }}</span>
    <span v-if="lease" :class="styles.lease">{{ lease }}</span>
  </span>
</template>
