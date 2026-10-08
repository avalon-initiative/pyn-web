<script setup lang="ts">
import { ref } from 'vue'
import styles from '../styles/PynKeys.module.scss'
import type { SshKey } from '../types/auth.types'

defineProps<{
  keys: SshKey[]
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{
  add: [{ key: string; title: string }]
  remove: [string]
}>()

const title = ref('')
const key = ref('')

function submit() {
  emit('add', { key: key.value.trim(), title: title.value })
  key.value = ''
  title.value = ''
}

const day = (iso: string) => iso.slice(0, 10)
</script>

<template>
  <section :class="styles.page">
    <h2 :class="styles.heading">SSH keys</h2>
    <p :class="styles.note">
      These keys sign you in from the command line, like on GitHub. A key can belong to one account
      only.
    </p>

    <ul v-if="keys.length" :class="styles.list">
      <li v-for="k in keys" :key="k.id" :class="styles.item">
        <div>
          <strong>{{ k.title }}</strong>
          <span :class="styles.meta"> · {{ k.algorithm }}</span>
          <div :class="styles.fingerprint">{{ k.fingerprint }}</div>
          <div :class="styles.meta">
            Added {{ day(k.created_at) }} ·
            {{ k.last_used_at ? `last used ${day(k.last_used_at)}` : 'never used' }}
          </div>
        </div>
        <button type="button" :class="styles.remove" :disabled="busy" @click="emit('remove', k.id)">
          Remove
        </button>
      </li>
    </ul>
    <p v-else :class="styles.empty">No keys yet.</p>

    <form :class="styles.form" @submit.prevent="submit">
      <h3 :class="styles.subheading">Add a key</h3>
      <label :class="styles.field"
        >Title (optional)
        <input v-model="title" :class="styles.input" placeholder="work laptop" />
      </label>
      <label :class="styles.field"
        >Public key
        <textarea
          v-model="key"
          :class="styles.input"
          rows="4"
          placeholder="ssh-ed25519 AAAA..."
          required
        />
      </label>
      <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
      <button type="submit" :class="styles.primary" :disabled="busy">Add key</button>
    </form>
  </section>
</template>
