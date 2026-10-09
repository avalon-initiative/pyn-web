<script setup lang="ts">
import { computed, ref } from 'vue'
import styles from '../styles/PynSignIn.module.scss'
import PynAccountNotice from './PynAccountNotice.vue'
import type { BlockedStatus, RegisterForm, RegistrationMode, SignInForm } from '../types/auth.types'

const props = defineProps<{
  registration: RegistrationMode | null
  emailVerification?: boolean
  notice?: { status: BlockedStatus; user?: string } | null
  resent?: boolean
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{
  signIn: [SignInForm]
  register: [RegisterForm]
  resend: [string]
  dismiss: []
}>()

type View = 'sign-in' | 'register'
const view = ref<View>('sign-in')
const username = ref('')
const password = ref('')
const invite = ref('')
const email = ref('')

const canRegister = computed(() => props.registration === 'open' || props.registration === 'invite')
const needsEmail = computed(() => props.registration === 'open' && !!props.emailVerification)
const needsInvite = computed(() => props.registration === 'invite')
const title = computed(() => ({ 'sign-in': 'Sign in', register: 'Create an account' })[view.value])

function submit() {
  if (view.value === 'sign-in')
    emit('signIn', { username: username.value, password: password.value })
  else {
    emit('register', {
      username: username.value,
      password: password.value,
      email: needsEmail.value ? email.value : undefined,
      invite: invite.value.trim() || undefined,
    })
  }
}
</script>

<template>
  <PynAccountNotice
    v-if="notice"
    :status="notice.status"
    :user="notice.user"
    :busy="busy"
    :sent="resent"
    :error="error"
    @resend="(address) => emit('resend', address)"
    @back="emit('dismiss')"
  />
  <form v-else :class="styles.card" @submit.prevent="submit">
    <h2 :class="styles.title">{{ title }}</h2>

    <label :class="styles.field"
      >User name
      <input v-model.trim="username" :class="styles.input" autocomplete="username" required />
    </label>
    <label :class="styles.field"
      >Password
      <input
        v-model="password"
        :class="styles.input"
        type="password"
        :autocomplete="view === 'register' ? 'new-password' : 'current-password'"
        required
      />
    </label>
    <label v-if="view === 'register' && needsEmail" :class="styles.field"
      >Email address
      <input
        v-model.trim="email"
        :class="styles.input"
        type="email"
        autocomplete="email"
        required
      />
    </label>
    <label v-if="view === 'register' && needsInvite" :class="styles.field"
      >Invitation code
      <input v-model.trim="invite" :class="styles.input" autocomplete="off" required />
    </label>

    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>

    <button type="submit" :class="styles.primary" :disabled="busy">{{ title }}</button>

    <p :class="styles.links">
      <button
        v-if="view !== 'sign-in'"
        type="button"
        :class="styles.link"
        @click="view = 'sign-in'"
      >
        Sign in
      </button>
      <button
        v-if="view !== 'register' && canRegister"
        type="button"
        :class="styles.link"
        @click="view = 'register'"
      >
        {{ needsInvite ? 'I have an invitation' : 'Create an account' }}
      </button>
    </p>
  </form>
</template>
