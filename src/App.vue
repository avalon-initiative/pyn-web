<script setup lang="ts">
import { onMounted, provide, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import styles from './styles/App.module.scss'
import PynSignIn from './components/PynSignIn.vue'
import { fetchRegistration, register, restoreSession, signIn, signOut } from './api/auth'
import { describeError } from './api/client'
import { sessionKey } from './state/context.state'
import { internalPath } from './state/links.state'
import type { RegisterForm, RegistrationMode, SignInForm } from './types/auth.types'

const router = useRouter()
const route = useRoute()
const user = ref('')
const error = ref('')
const busy = ref(false)
const registration = ref<RegistrationMode | null>(null)
const ready = ref(false)

const expire = () => (user.value = '')
provide(sessionKey, { user, expire })

async function attempt(action: () => Promise<void>) {
  busy.value = true
  error.value = ''
  try {
    await action()
  } catch (e) {
    error.value = describeError(e)
  } finally {
    busy.value = false
  }
}

const submitSignIn = (form: SignInForm) =>
  attempt(async () => {
    user.value = (await signIn(form)).user
  })

const join = (form: RegisterForm) =>
  attempt(async () => {
    await register(form)
    user.value = (await signIn(form)).user
  })

async function leave() {
  await signOut().catch(() => undefined)
  user.value = ''
  await router.push('/')
}

function followLink(e: MouseEvent) {
  const path = internalPath(e, window.location.origin)
  if (path === null) return
  e.preventDefault()
  router.push(path)
}

onMounted(async () => {
  registration.value = await fetchRegistration().catch(() => null)
  user.value = (await restoreSession().catch(() => null))?.user ?? ''
  ready.value = true
})
</script>

<template>
  <main :class="styles.page" @click="followLink">
    <PynSignIn
      v-if="ready && !user"
      :registration="registration"
      :busy="busy"
      :error="error"
      @sign-in="submitSignIn"
      @register="join"
    />
    <template v-else-if="user">
      <header :class="styles.header">
        <p :class="styles.summary">Signed in as {{ user }}</p>
        <nav :class="styles.nav">
          <a href="/" :class="styles.navLink" :aria-current="route.name === 'repos'"
            >Repositories</a
          >
          <a href="/_/keys" :class="styles.navLink" :aria-current="route.name === 'keys'"
            >SSH keys</a
          >
          <button type="button" :class="styles.signOut" @click="leave">Sign out</button>
        </nav>
      </header>
      <RouterView />
    </template>
  </main>
</template>
