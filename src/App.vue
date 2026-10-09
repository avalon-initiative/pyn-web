<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import styles from './styles/App.module.scss'
import PynShell from './components/PynShell.vue'
import PynSideNav from './components/PynSideNav.vue'
import PynSignIn from './components/PynSignIn.vue'
import PynTopBar from './components/PynTopBar.vue'
import {
  fetchRegistration,
  register,
  resendVerification,
  restoreSession,
  signIn,
  signOut,
} from './api/auth'
import { describeError } from './api/client'
import { blockedStatus } from './state/account.state'
import { listRepos } from './api/repos'
import { sessionKey } from './state/context.state'
import { internalPath } from './state/links.state'
import { repoSlug, sortRepos } from './state/repo.state'
import { activeNav, mainNav } from './state/shell.state'
import { applyTheme, loadTheme, saveTheme } from './state/theme.state'
import type { ThemeChoice } from './state/theme.state'
import type { RepoInfo } from './types/repo.types'
import type { BlockedStatus, RegisterForm, RegistrationInfo, SignInForm } from './types/auth.types'

const router = useRouter()
const route = useRoute()
const user = ref('')
const error = ref('')
const busy = ref(false)
const registration = ref<RegistrationInfo | null>(null)
const notice = ref<{ status: BlockedStatus; user?: string } | null>(null)
const resent = ref(false)
const ready = ref(false)
const repos = ref<RepoInfo[]>([])
const theme = ref<ThemeChoice>(loadTheme())
applyTheme(theme.value)

const slugs = computed(() => repos.value.map(repoSlug))
const currentRepo = computed(() =>
  route.params.owner ? `${String(route.params.owner)}/${String(route.params.name)}` : '',
)

function setTheme(choice: ThemeChoice) {
  theme.value = choice
  applyTheme(choice)
  saveTheme(choice)
}

// The sidebar list follows creation and deletion, which both change the route.
watch(
  () => [user.value, route.name],
  async () => {
    if (!user.value) return (repos.value = [])
    repos.value = sortRepos(await listRepos().catch(() => repos.value))
  },
)

const expire = () => (user.value = '')
provide(sessionKey, { user, expire })

async function attempt(action: () => Promise<void>) {
  busy.value = true
  error.value = ''
  try {
    await action()
  } catch (e) {
    const status = blockedStatus(e)
    if (status) notice.value = { status, user: pendingUser.value }
    else error.value = describeError(e)
  } finally {
    busy.value = false
  }
}

const pendingUser = ref('')

const submitSignIn = (form: SignInForm) =>
  attempt(async () => {
    pendingUser.value = form.username
    user.value = (await signIn(form)).user
  })

const join = (form: RegisterForm) =>
  attempt(async () => {
    pendingUser.value = form.username
    const { status } = await register(form)
    if (status === 'active') user.value = (await signIn(form)).user
    else notice.value = { status, user: form.username }
  })

const resend = (email: string) =>
  attempt(async () => {
    resent.value = false
    await resendVerification(email)
    resent.value = true
  })

function dismissNotice() {
  notice.value = null
  resent.value = false
  error.value = ''
}

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
  <div :class="styles.page" @click="followLink">
    <main v-if="ready && !user" :class="styles.signedOut">
      <RouterView v-if="route.name === 'verify-email'" />
      <PynSignIn
        v-else
        :registration="registration?.registration ?? null"
        :email-verification="registration?.email_verification"
        :notice="notice"
        :resent="resent"
        :busy="busy"
        :error="error"
        @sign-in="submitSignIn"
        @register="join"
        @resend="resend"
        @dismiss="dismissNotice"
      />
    </main>
    <template v-else-if="user">
      <PynShell>
        <template #top>
          <PynTopBar
            :user="user"
            :repos="slugs"
            :theme="theme"
            @open="(slug) => router.push(`/${slug}`)"
            @theme="setTheme"
            @sign-out="leave"
          />
        </template>
        <template #side>
          <PynSideNav
            :account="user"
            :items="mainNav"
            :current="activeNav(route.path)"
            :repos="repos"
            :current-repo="currentRepo"
          />
        </template>
        <RouterView />
      </PynShell>
    </template>
  </div>
</template>
