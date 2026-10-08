<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import styles from './styles/App.module.scss'
import PynFileList from './components/PynFileList.vue'
import PynKeys from './components/PynKeys.vue'
import PynSignIn from './components/PynSignIn.vue'
import { endSession, fetchRegistration, login, register } from './api/auth'
import { ApiError, fetchFiles, fetchMe } from './api/client'
import { addKey, listKeys, removeKey } from './api/keys'
import { loadCredential, saveCredential, tokenId } from './state/credential.state'
import { groupByTopLevel } from './state/files.state'
import type { RegisterForm, RegistrationMode, SignInForm, SshKey } from './types/auth.types'
import type { FileRow, Me } from './types/lock.types'

const rows = ref<FileRow[]>([])
const me = ref<Me | null>(null)
const error = ref('')
const busy = ref(false)
const registration = ref<RegistrationMode | null>(null)
const view = ref<'files' | 'keys'>('files')
const keys = ref<SshKey[]>([])
const now = ref(new Date())
const credential = ref(loadCredential())
let timer: ReturnType<typeof setInterval> | undefined

const groups = computed(() => groupByTopLevel(rows.value))
const lockedCount = computed(() => rows.value.filter((r) => r.lock).length)

function describe(e: unknown): string {
  if (e instanceof ApiError) return e.message
  return `Could not reach pyn-server: ${e instanceof Error ? e.message : String(e)}`
}

async function refresh() {
  now.value = new Date()
  if (!credential.value) return
  try {
    me.value = await fetchMe(credential.value)
    rows.value = await fetchFiles(credential.value)
    error.value = ''
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      credential.value = ''
    }
    error.value = describe(e)
  }
}

async function attempt(action: () => Promise<void>) {
  busy.value = true
  error.value = ''
  try {
    await action()
  } catch (e) {
    error.value = describe(e)
  } finally {
    busy.value = false
  }
}

const signIn = (form: SignInForm) =>
  attempt(async () => {
    credential.value = (await login(form)).token
  })

const join = (form: RegisterForm) =>
  attempt(async () => {
    await register(form)
    credential.value = (await login(form)).token
  })

async function showKeys() {
  view.value = 'keys'
  await attempt(async () => {
    keys.value = await listKeys(credential.value)
  })
}

const newKey = (form: { key: string; title: string }) =>
  attempt(async () => {
    await addKey(credential.value, form.key, form.title)
    keys.value = await listKeys(credential.value)
  })

const deleteKey = (id: string) =>
  attempt(async () => {
    await removeKey(credential.value, id)
    keys.value = await listKeys(credential.value)
  })

async function signOut() {
  const id = tokenId(credential.value)
  if (id) await endSession(credential.value, id).catch(() => undefined)
  credential.value = ''
}

watch(credential, (value) => {
  saveCredential(value)
  if (value) refresh()
  else {
    me.value = null
    rows.value = []
  }
})

onMounted(async () => {
  registration.value = await fetchRegistration().catch(() => null)
  refresh()
  timer = setInterval(refresh, 15_000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <main :class="styles.page">
    <PynSignIn
      v-if="!credential"
      :registration="registration"
      :busy="busy"
      :error="error"
      @sign-in="signIn"
      @register="join"
      @use-credential="credential = $event"
    />
    <template v-else>
      <header :class="styles.header">
        <div>
          <h1 :class="styles.title">{{ view === 'files' ? 'Files' : 'Account' }}</h1>
          <p :class="styles.summary">
            <template v-if="me">Signed in as {{ me.user }} · </template>{{ rows.length }} files,
            {{ lockedCount }} locked
          </p>
        </div>
        <nav :class="styles.nav">
          <button
            type="button"
            :class="styles.navLink"
            :aria-current="view === 'files'"
            @click="view = 'files'"
          >
            Files
          </button>
          <button
            type="button"
            :class="styles.navLink"
            :aria-current="view === 'keys'"
            @click="showKeys"
          >
            SSH keys
          </button>
          <button type="button" :class="styles.signOut" @click="signOut">Sign out</button>
        </nav>
      </header>
      <template v-if="view === 'files'">
        <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
        <section v-for="group in groups" :key="group.name" :class="styles.group">
          <h2 :class="styles.groupTitle">{{ group.name }}</h2>
          <PynFileList :rows="group.rows" :me="me?.user" :now="now" />
        </section>
      </template>
      <PynKeys v-else :keys="keys" :busy="busy" :error="error" @add="newKey" @remove="deleteKey" />
    </template>
  </main>
</template>
