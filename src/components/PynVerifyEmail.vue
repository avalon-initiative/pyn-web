<script setup lang="ts">
import styles from '../styles/PynVerifyEmail.module.scss'
import type { AccountStatus, VerifyOutcome } from '../types/auth.types'
import PynResendForm from './PynResendForm.vue'

defineProps<{
  outcome: VerifyOutcome
  status?: AccountStatus
  user?: string
  error?: string
  resendError?: string
  busy?: boolean
  sent?: boolean
}>()
const emit = defineEmits<{ resend: [string] }>()
</script>

<template>
  <section :class="styles.card">
    <template v-if="outcome === 'verifying'">
      <h2 :class="styles.title">Verifying your email</h2>
      <p :class="styles.text" role="status">One moment.</p>
    </template>

    <template v-else-if="outcome === 'verified'">
      <h2 :class="styles.title">Email verified</h2>
      <p :class="styles.text" role="status">
        <template v-if="status === 'pending_approval'"
          >Thanks{{ user ? `, ${user}` : '' }}. An administrator of this server must approve the
          account before you can sign in.</template
        >
        <template v-else>Thanks{{ user ? `, ${user}` : '' }}. You can sign in now.</template>
      </p>
    </template>

    <template v-else>
      <h2 :class="styles.title">Link not valid</h2>
      <p :class="styles.text" role="alert">
        {{ error || 'This link is not valid. It may be used already or expired.' }}
      </p>
      <PynResendForm
        :busy="busy"
        :sent="sent"
        :error="resendError"
        @resend="(email) => emit('resend', email)"
      />
    </template>

    <a v-if="outcome !== 'verifying'" href="/" :class="styles.link">Go to sign in</a>
  </section>
</template>
