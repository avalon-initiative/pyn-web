<script setup lang="ts">
import { ref } from 'vue'
import styles from '../styles/PynInvites.module.scss'
import type { InviteInfo } from '../types/repo.types'

const props = defineProps<{
  invites: InviteInfo[]
  roles: string[]
  /** The code of the invitation just created; the server shows it only once. */
  code?: string
  busy?: boolean
  error?: string
}>()
const emit = defineEmits<{ create: [{ role: string; hours: number }]; revoke: [string] }>()

const role = ref(props.roles[0] ?? 'reader')
const hours = ref(72)

function state(i: InviteInfo): string {
  if (i.revoked_at) return 'revoked'
  if (i.used_by) return `used by ${i.used_by}`
  return `expires ${i.expires_at.slice(0, 10)}`
}
</script>

<template>
  <section :class="styles.page">
    <p v-if="code" :class="styles.code" role="status">
      Invitation code (shown once): <code>{{ code }}</code>
    </p>
    <ul v-if="invites.length" :class="styles.list">
      <li v-for="i in invites" :key="i.id" :class="styles.item">
        <div>
          <strong>{{ i.role }}</strong>
          <div :class="styles.meta">by {{ i.created_by }} · {{ state(i) }}</div>
        </div>
        <button
          v-if="!i.revoked_at && !i.used_by"
          type="button"
          :class="styles.danger"
          :disabled="busy"
          @click="emit('revoke', i.id)"
        >
          Revoke
        </button>
      </li>
    </ul>
    <p v-else :class="styles.empty">No invitations.</p>

    <form :class="styles.form" @submit.prevent="emit('create', { role, hours: Number(hours) })">
      <h3 :class="styles.subheading">New invitation</h3>
      <label :class="styles.field"
        >Role
        <select v-model="role" :class="styles.input">
          <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
        </select>
      </label>
      <label :class="styles.field"
        >Valid for (hours)
        <input v-model="hours" :class="styles.input" type="number" min="1" required />
      </label>
      <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
      <button type="submit" :class="styles.primary" :disabled="busy">Create invitation</button>
    </form>
  </section>
</template>
