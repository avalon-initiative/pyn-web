<script setup lang="ts">
import { computed, ref } from 'vue'
import styles from '../styles/PynSignIn.module.scss'
import type { RegisterForm, RegistrationMode, SignInForm } from '../types/auth.types'

const props = defineProps<{
  registration: RegistrationMode | null
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{
  signIn: [SignInForm]
  register: [RegisterForm]
}>()

type View = 'sign-in' | 'register'
const view = ref<View>('sign-in')
const username = ref('')
const password = ref('')
const invite = ref('')

const canRegister = computed(() => props.registration === 'open' || props.registration === 'invite')
const needsInvite = computed(() => props.registration === 'invite')
const title = computed(() => ({ 'sign-in': 'Sign in', register: 'Create an account' })[view.value])

function submit() {
  if (view.value === 'sign-in')
    emit('signIn', { username: username.value, password: password.value })
  else {
    emit('register', {
      username: username.value,
      password: password.value,
      invite: invite.value.trim() || undefined,
    })
  }
}
</script>

<template>
  <form :class="styles.card" @submit.prevent="submit">
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
