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
  useCredential: [string]
}>()

type View = 'sign-in' | 'register' | 'token'
const view = ref<View>('sign-in')
const username = ref('')
const password = ref('')
const invite = ref('')
const credential = ref('')

const canRegister = computed(() => props.registration === 'open' || props.registration === 'invite')
const needsInvite = computed(() => props.registration === 'invite')
const title = computed(
  () => ({ 'sign-in': 'Sign in', register: 'Create an account', token: 'Use a token' })[view.value],
)

function submit() {
  if (view.value === 'sign-in')
    emit('signIn', { username: username.value, password: password.value })
  else if (view.value === 'register') {
    emit('register', {
      username: username.value,
      password: password.value,
      invite: invite.value.trim() || undefined,
    })
  } else emit('useCredential', credential.value.trim())
}
</script>

<template>
  <form :class="styles.card" @submit.prevent="submit">
    <h2 :class="styles.title">{{ title }}</h2>

    <template v-if="view !== 'token'">
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
    </template>
    <label v-else :class="styles.field"
      >Token or development user name
      <input
        v-model="credential"
        :class="styles.input"
        type="password"
        autocomplete="off"
        required
      />
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
        Sign in with a password
      </button>
      <button
        v-if="view !== 'register' && canRegister"
        type="button"
        :class="styles.link"
        @click="view = 'register'"
      >
        {{ needsInvite ? 'I have an invitation' : 'Create an account' }}
      </button>
      <button v-if="view !== 'token'" type="button" :class="styles.link" @click="view = 'token'">
        Use a token
      </button>
    </p>
  </form>
</template>
