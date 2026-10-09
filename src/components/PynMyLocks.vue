<script setup lang="ts">
import { ref } from 'vue'
import PynLockIcon from './PynLockIcon.vue'
import styles from '../styles/PynMyLocks.module.scss'
import { formatDateTime } from '../state/datetime.state'
import { formatLease } from '../state/lease.state'
import { myLockKey } from '../state/my-locks.state'
import { repoPath, repoSlug } from '../state/repo.state'
import type { MyLock, ReleaseFailure } from '../types/lock.types'

const props = defineProps<{
  locks: MyLock[]
  failures?: ReleaseFailure[]
  now?: Date
  busy?: boolean
  error?: string
}>()
const emit = defineEmits<{ release: [MyLock]; releaseAll: [] }>()

const confirming = ref(false)

const failureFor = (lock: MyLock) =>
  props.failures?.find((f) => myLockKey(f.lock) === myLockKey(lock))?.message

function releaseAll() {
  confirming.value = false
  emit('releaseAll')
}
</script>

<template>
  <section :class="styles.page">
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <div v-if="locks.length" :class="styles.bar">
      <p :class="styles.count">
        {{ locks.length }} active {{ locks.length === 1 ? 'lock' : 'locks' }}
      </p>
      <form v-if="confirming" :class="styles.confirm" @submit.prevent="releaseAll">
        <span>Release all {{ locks.length }}?</span>
        <button type="submit" :class="styles.danger" :disabled="busy">Release all</button>
        <button type="button" :class="styles.quiet" @click="confirming = false">Cancel</button>
      </form>
      <button
        v-else
        type="button"
        :class="styles.danger"
        :disabled="busy"
        @click="confirming = true"
      >
        Release all
      </button>
    </div>
    <ul v-if="locks.length" :class="styles.list">
      <li v-for="lock in locks" :key="myLockKey(lock)" :class="styles.item">
        <span :class="styles.what">
          <a :href="repoPath(lock)" :class="styles.repo">{{ repoSlug(lock) }}</a>
          <span :class="styles.path"><PynLockIcon :class="styles.lockIcon" />{{ lock.path }}</span>
          <span v-if="failureFor(lock)" :class="styles.failure" role="alert">{{
            failureFor(lock)
          }}</span>
        </span>
        <span :class="styles.meta" :title="`Expires ${formatDateTime(lock.expires_at)}`">{{
          formatLease(lock.expires_at, now ?? new Date())
        }}</span>
        <button type="button" :class="styles.quiet" :disabled="busy" @click="emit('release', lock)">
          Release
        </button>
      </li>
    </ul>
    <p v-else :class="styles.empty">You hold no locks.</p>
  </section>
</template>
