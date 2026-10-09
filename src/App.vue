<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import styles from './styles/App.module.scss'
import PynShell from './components/PynShell.vue'
import PynSideNav from './components/PynSideNav.vue'
import PynSignIn from './components/PynSignIn.vue'
import PynTopBar from './components/PynTopBar.vue'
import { fetchRegistration, register, restoreSession, signIn, signOut } from './api/auth'
import { describeError } from './api/client'
import { listRepos } from './api/repos'
import { sessionKey } from './state/context.state'
import { internalPath } from './state/links.state'
import { repoSlug, sortRepos } from './state/repo.state'
import { activeNav, mainNav } from './state/shell.state'
import { applyTheme, loadTheme, saveTheme } from './state/theme.state'
import type { ThemeChoice } from './state/theme.state'
import type { RepoInfo } from './types/repo.types'
import type { RegisterForm, RegistrationMode, SignInForm } from './types/auth.types'

const router = useRouter()
const route = useRoute()
const user = ref('')
const error = ref('')
const busy = ref(false)
const registration = ref<RegistrationMode | null>(null)
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
  <div :class="styles.page" @click="followLink">
    <main v-if="ready && !user" :class="styles.signedOut">
      <PynSignIn
        :registration="registration"
        :busy="busy"
        :error="error"
        @sign-in="submitSignIn"
        @register="join"
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
