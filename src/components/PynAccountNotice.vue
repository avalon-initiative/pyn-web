<script setup lang="ts">
import styles from '../styles/PynAccountNotice.module.scss'
import { NOTICE_TEXT, NOTICE_TITLES } from '../state/account.state'
import type { BlockedStatus } from '../types/auth.types'
import PynResendForm from './PynResendForm.vue'

defineProps<{
  status: BlockedStatus
  user?: string
  busy?: boolean
  sent?: boolean
  error?: string
}>()
const emit = defineEmits<{ resend: [string]; back: [] }>()
</script>

<template>
  <section :class="[styles.card, status === 'account_disabled' && styles.disabled]">
    <h2 :class="styles.title">{{ NOTICE_TITLES[status] }}</h2>
    <p :class="styles.text">
      <template v-if="user"
        >Account <strong>{{ user }}</strong
        >.
      </template>
      {{ NOTICE_TEXT[status] }}
    </p>
    <PynResendForm
      v-if="status === 'pending_verification'"
      :busy="busy"
      :sent="sent"
      :error="error"
      @resend="(email) => emit('resend', email)"
    />
    <button type="button" :class="styles.link" @click="emit('back')">Back to sign in</button>
  </section>
</template>
