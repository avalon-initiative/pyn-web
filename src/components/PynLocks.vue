<script setup lang="ts">
import { ref } from 'vue'
import styles from '../styles/PynLocks.module.scss'
import { formatLease } from '../state/lease.state'
import type { LockInfo } from '../types/lock.types'

defineProps<{ locks: LockInfo[]; canForce?: boolean; now?: Date; busy?: boolean; error?: string }>()
const emit = defineEmits<{ forceUnlock: [{ path: string; reason: string }] }>()

const forcing = ref('')
const reason = ref('')

function confirm() {
  emit('forceUnlock', { path: forcing.value, reason: reason.value.trim() })
  forcing.value = ''
  reason.value = ''
}
</script>

<template>
  <section :class="styles.page">
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <ul v-if="locks.length" :class="styles.list">
      <li v-for="lock in locks" :key="lock.path" :class="styles.item">
        <span :class="styles.path">{{ lock.path }}</span>
        <span :class="styles.meta"
          >{{ lock.owner }} · {{ formatLease(lock.expires_at, now ?? new Date()) }}</span
        >
        <button
          v-if="canForce && forcing !== lock.path"
          type="button"
          :class="styles.danger"
          @click="forcing = lock.path"
        >
          Force unlock
        </button>
        <form v-else-if="forcing === lock.path" :class="styles.reason" @submit.prevent="confirm">
          <input v-model="reason" :class="styles.input" placeholder="Reason" required />
          <button type="submit" :class="styles.danger" :disabled="busy">Unlock</button>
          <button type="button" :class="styles.quiet" @click="forcing = ''">Cancel</button>
        </form>
      </li>
    </ul>
    <p v-else :class="styles.empty">No locks are held.</p>
  </section>
</template>
