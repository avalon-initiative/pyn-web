<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import styles from '../styles/PynSetup.module.scss'
import { REGISTRATION_LABELS, SETUP_STEPS, stepComplete } from '../state/setup.state'
import type { RegistrationMode, SetupForm } from '../types/auth.types'

const props = defineProps<{
  serverName?: string
  publicUrl?: string
  registration: RegistrationMode
  done?: boolean
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{
  finish: [SetupForm]
  signIn: []
}>()

const index = ref(0)
const form = reactive<SetupForm>({
  token: '',
  username: '',
  password: '',
  email: '',
  server_name: props.serverName ?? '',
  public_url: props.publicUrl ?? '',
  registration: props.registration,
})

const step = computed(() => SETUP_STEPS[index.value])
const last = computed(() => index.value === SETUP_STEPS.length - 1)
const titles: Record<(typeof SETUP_STEPS)[number], string> = {
  welcome: 'Set up your server',
  token: 'Setup token',
  admin: 'First administrator',
  server: 'Server name and address',
  registration: 'Who can sign up',
  review: 'Review',
}

function next() {
  if (!stepComplete(step.value, form)) return
  if (last.value) emit('finish', { ...form })
  else index.value += 1
}
</script>

<template>
  <section v-if="done" :class="styles.card">
    <h2 :class="styles.title">Your server is ready</h2>
    <p :class="styles.note">
      {{ form.username }} is the administrator. Sign in to start creating repositories.
    </p>
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <button type="button" :class="styles.primary" :disabled="busy" @click="emit('signIn')">
      Sign in
    </button>
  </section>
  <form v-else :class="styles.card" @submit.prevent="next">
    <p :class="styles.progress">Step {{ index + 1 }} of {{ SETUP_STEPS.length }}</p>
    <h2 :class="styles.title">{{ titles[step] }}</h2>

    <template v-if="step === 'welcome'">
      <p :class="styles.note">
        This server has not been set up yet. You will create the first administrator and choose how
        people join. It takes a minute.
      </p>
    </template>

    <template v-else-if="step === 'token'">
      <p :class="styles.note">
        Find the setup token in the server's log when it starts, or in its
        <code>PYN_SETUP_TOKEN</code> setting.
      </p>
      <label :class="styles.field"
        >Setup token
        <input v-model.trim="form.token" :class="styles.input" autocomplete="off" required />
      </label>
    </template>

    <template v-else-if="step === 'admin'">
      <label :class="styles.field"
        >User name
        <input
          v-model.trim="form.username"
          :class="styles.input"
          autocomplete="username"
          required
        />
      </label>
      <label :class="styles.field"
        >Password
        <input
          v-model="form.password"
          :class="styles.input"
          type="password"
          autocomplete="new-password"
          required
        />
      </label>
      <label :class="styles.field"
        >Email address (optional)
        <input v-model.trim="form.email" :class="styles.input" type="email" autocomplete="email" />
      </label>
    </template>

    <template v-else-if="step === 'server'">
      <label :class="styles.field"
        >Server name (optional)
        <input v-model.trim="form.server_name" :class="styles.input" />
      </label>
      <label :class="styles.field"
        >Public address
        <input
          v-model.trim="form.public_url"
          :class="styles.input"
          type="url"
          placeholder="https://pyn.example.com"
        />
      </label>
    </template>

    <template v-else-if="step === 'registration'">
      <label v-for="(label, mode) in REGISTRATION_LABELS" :key="mode" :class="styles.choice"
        ><input v-model="form.registration" type="radio" name="registration" :value="mode" />
        {{ label }}</label
      >
      <p :class="styles.note">
        Email is only written to the server log until a mail sender is configured, so verification
        and invitation emails will not reach anyone yet.
      </p>
    </template>

    <dl v-else :class="styles.review">
      <dt>Administrator</dt>
      <dd>{{ form.username }}</dd>
      <dt>Email</dt>
      <dd>{{ form.email || 'none' }}</dd>
      <dt>Server name</dt>
      <dd>{{ form.server_name || 'none' }}</dd>
      <dt>Public address</dt>
      <dd>{{ form.public_url || 'none' }}</dd>
      <dt>Registration</dt>
      <dd>{{ REGISTRATION_LABELS[form.registration] }}</dd>
    </dl>

    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>

    <div :class="styles.actions">
      <button v-if="index > 0" type="button" :class="styles.link" @click="index -= 1">Back</button>
      <button type="submit" :class="styles.primary" :disabled="busy">
        {{ last ? 'Finish setup' : step === 'welcome' ? 'Begin' : 'Continue' }}
      </button>
    </div>
  </form>
</template>
