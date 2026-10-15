<script setup lang="ts">
import { ref } from 'vue'
import styles from '../styles/PynTokens.module.scss'
import { formatDate } from '@avalon-initiative/pyn-common-ui'
import { expiryFromDate, parseRepos, TOKEN_PERMISSIONS } from '../state/token.state'
import type { TokenForm, TokenInfo } from '../types/token.types'

defineProps<{
  tokens: TokenInfo[]
  secret?: string
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{
  create: [TokenForm]
  revoke: [string]
  dismiss: []
}>()

const name = ref('')
const repos = ref('')
const permissions = ref<string[]>(['read'])
const expires = ref('')

function submit() {
  emit('create', {
    name: name.value.trim(),
    repos: parseRepos(repos.value),
    permissions: permissions.value,
    expires_at: expiryFromDate(expires.value),
  })
  name.value = ''
  repos.value = ''
  permissions.value = ['read']
  expires.value = ''
}
</script>

<template>
  <section :class="styles.page">
    <h2 :class="styles.heading">Personal access tokens</h2>
    <p :class="styles.note">
      Tokens let scripts and automation act as you on the repositories you pick. A token never
      grants more than your role allows.
    </p>

    <div v-if="secret" :class="styles.secret" role="status">
      <strong>Copy your new token now. It is shown once.</strong>
      <code :class="styles.code">{{ secret }}</code>
      <button type="button" :class="styles.remove" @click="emit('dismiss')">Done</button>
    </div>

    <ul v-if="tokens.length" :class="styles.list">
      <li v-for="t in tokens" :key="t.id" :class="styles.item">
        <div>
          <strong>{{ t.name }}</strong>
          <span v-if="t.revoked_at" :class="styles.meta"> · revoked</span>
          <div :class="styles.meta">
            {{ t.repos.length ? t.repos.join(', ') : 'every repository' }} ·
            {{ t.permissions.join(', ') }}
          </div>
          <div :class="styles.meta">
            Created {{ formatDate(t.created_at) }} ·
            {{ t.expires_at ? `expires ${formatDate(t.expires_at)}` : 'no expiry' }} ·
            {{ t.last_used_at ? `last used ${formatDate(t.last_used_at)}` : 'never used' }}
          </div>
        </div>
        <button
          v-if="!t.revoked_at"
          type="button"
          :class="styles.remove"
          :disabled="busy"
          @click="emit('revoke', t.id)"
        >
          Revoke
        </button>
      </li>
    </ul>
    <p v-else :class="styles.empty">No tokens yet.</p>

    <form :class="styles.form" @submit.prevent="submit">
      <h3 :class="styles.subheading">Create a token</h3>
      <label :class="styles.field"
        >Name
        <input v-model="name" :class="styles.input" placeholder="ci" required />
      </label>
      <label :class="styles.field"
        >Repositories (owner/name, one per line)
        <textarea v-model="repos" :class="styles.input" rows="3" placeholder="acme/game" required />
      </label>
      <fieldset :class="styles.field">
        <legend>Permissions</legend>
        <label v-for="p in TOKEN_PERMISSIONS" :key="p" :class="styles.check"
          ><input v-model="permissions" type="checkbox" :value="p" /> {{ p }}</label
        >
      </fieldset>
      <label :class="styles.field"
        >Expires (optional)
        <input v-model="expires" type="date" :class="styles.input" />
      </label>
      <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
      <button type="submit" :class="styles.primary" :disabled="busy">Create token</button>
    </form>
  </section>
</template>
