<script setup lang="ts">
import styles from '../styles/PynIdentities.module.scss'
import { formatDate } from '@avalon-initiative/pyn-common-ui'
import type { ExternalIdentity, ExternalProvider } from '../types/auth.types'

defineProps<{
  identities: ExternalIdentity[]
  provider: ExternalProvider
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{
  link: []
  unlink: [string]
}>()
</script>

<template>
  <section :class="styles.page">
    <h2 :class="styles.heading">Linked sign-in</h2>
    <p :class="styles.note">
      Link {{ provider.name }} to sign in with it. Passwords, tokens and SSH keys keep working.
    </p>

    <ul v-if="identities.length" :class="styles.list">
      <li v-for="i in identities" :key="i.id" :class="styles.item">
        <div>
          <strong>{{ i.email || i.subject }}</strong>
          <div :class="styles.meta">{{ i.issuer }}</div>
          <div :class="styles.meta">
            Linked {{ formatDate(i.created_at) }} ·
            {{
              i.last_sign_in_at ? `last signed in ${formatDate(i.last_sign_in_at)}` : 'never used'
            }}
          </div>
        </div>
        <button type="button" :class="styles.remove" :disabled="busy" @click="emit('unlink', i.id)">
          Unlink
        </button>
      </li>
    </ul>
    <p v-else :class="styles.empty">Nothing linked yet.</p>

    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <button type="button" :class="styles.primary" :disabled="busy" @click="emit('link')">
      Link {{ provider.name }}
    </button>
  </section>
</template>
