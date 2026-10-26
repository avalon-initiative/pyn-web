<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  completeSetup,
  fetchRegistration,
  fetchSignInOptions,
  fetchSetupStatus,
  register,
  resendVerification,
  restoreSession,
  signIn,
  signOut,
} from './api/auth'
import { fetchMe } from './api/admin'
import { describeError } from './api/client'
import { blockedStatus } from './state/account.state'
import { listMyOrgs } from './api/orgs'
import { listRepos } from './api/repos'
import { sessionKey } from './state/context.state'
import { nameProblem, useNameCheck } from './state/name.state'
import { internalPath } from './state/links.state'
import { sortRepos } from './state/repo.state'
import { activeNav } from './state/shell.state'
import {
  PynShell,
  PynSignIn,
  PynSideNav,
  PynTopBar,
  applyTheme,
  loadTheme,
  repoSlug,
  saveTheme,
  sortOrgs,
  PynSetup,
  navItems,
} from '@avalon-initiative/pyn-common-ui'
import type { ThemeChoice } from '@avalon-initiative/pyn-common-ui'
import type { OrgInfo } from '@avalon-initiative/pyn-common-ui'
import type { RepoInfo } from '@avalon-initiative/pyn-common-ui'
import type {
  BlockedStatus,
  RegisterForm,
  SetupForm,
  SetupStatus,
  SignInForm,
} from '@avalon-initiative/pyn-common-ui'
import type { RegistrationInfo, SignInOptions } from './types/auth.types'

const router = useRouter()
const route = useRoute()
const user = ref('')
const admin = ref(false)
const error = ref('')
const { nameMessage, checkName } = useNameCheck()
const busy = ref(false)
const registration = ref<RegistrationInfo | null>(null)
const signInOptions = ref<SignInOptions | null>(null)
const callbackError = new URLSearchParams(window.location.search).get('error') ?? ''
const notice = ref<{ status: BlockedStatus; user?: string } | null>(null)
const resent = ref(false)
const ready = ref(false)
const repos = ref<RepoInfo[]>([])
const orgs = ref<OrgInfo[]>([])
const theme = ref<ThemeChoice>(loadTheme())
applyTheme(theme.value)

const slugs = computed(() => repos.value.map(repoSlug))
const currentRepo = computed(() =>
  route.params.owner && route.params.name
    ? `${String(route.params.owner)}/${String(route.params.name)}`
    : '',
)
const currentOrg = computed(() =>
  route.params.owner && !route.params.name ? String(route.params.owner) : '',
)

function setTheme(choice: ThemeChoice) {
  theme.value = choice
  applyTheme(choice)
  saveTheme(choice)
}

// The sidebar lists follow creation and deletion, which both change the route.
watch(
  () => [user.value, route.name],
  async () => {
    if (!user.value) return ((repos.value = []), (orgs.value = []))
    repos.value = sortRepos(await listRepos().catch(() => repos.value))
    orgs.value = sortOrgs(await listMyOrgs().catch(() => orgs.value))
  },
)

const expire = () => {
  user.value = ''
  admin.value = false
}
provide(sessionKey, { user, admin, expire })

/** Reads the admin flag before the user is set, so admin pages do not flash as not found. */
async function begin(name: string) {
  admin.value = (await fetchMe().catch(() => null))?.admin === true
  user.value = name
}

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

/** Shows the format problem and returns true when the name cannot be valid. */
function refuseName(name: string): boolean {
  error.value = nameProblem(name)
  return error.value !== ''
}
const setup = ref<SetupStatus | null>(null)
const setupDone = ref<SetupForm | null>(null)

const finishSetup = (form: SetupForm) =>
  attempt(async () => {
    if (refuseName(form.username)) return
    await completeSetup(form)
    setupDone.value = form
  })

const enterAfterSetup = () =>
  attempt(async () => {
    if (!setupDone.value) return
    const { username, password } = setupDone.value
    await begin((await signIn({ username, password })).user)
    setup.value = null
    setupDone.value = null
  })

const submitSignIn = (form: SignInForm) =>
  attempt(async () => {
    pendingUser.value = form.username
    await begin((await signIn(form)).user)
  })

const join = (form: RegisterForm) =>
  attempt(async () => {
    if (refuseName(form.username)) return
    pendingUser.value = form.username
    const { status } = await register(form)
    if (status === 'active') await begin((await signIn(form)).user)
    else
      notice.value = {
        status: status === 'disabled' ? 'account_disabled' : status,
        user: form.username,
      }
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
  expire()
  await router.push('/')
}

function followLink(e: MouseEvent) {
  const path = internalPath(e, window.location.origin)
  if (path === null) return
  e.preventDefault()
  router.push(path)
}

onMounted(async () => {
  const status = await fetchSetupStatus().catch(() => null)
  if (status && !status.initialised) setup.value = status
  registration.value = await fetchRegistration().catch(() => null)
  signInOptions.value = await fetchSignInOptions().catch(() => null)
  const session = await restoreSession().catch(() => null)
  if (session) await begin(session.user)
  ready.value = true
})
</script>

<template>
  <div @click="followLink">
    <main v-if="ready && setup">
      <PynSetup
        :server-name="setup.server_name ?? undefined"
        :public-url="setup.public_url"
        :registration="setup.registration"
        :done="!!setupDone"
        :busy="busy"
        :error="error"
        :name-message="nameMessage"
        @name-input="checkName"
        @finish="finishSetup"
        @sign-in="enterAfterSetup"
      />
    </main>
    <main v-else-if="ready && !user">
      <RouterView v-if="route.name === 'verify-email'" />
      <PynSignIn
        v-else
        :registration="registration?.registration ?? null"
        :external="signInOptions?.external"
        :password-sign-in="signInOptions?.password"
        :return-to="route.fullPath"
        :callback-error="callbackError"
        :email-verification="registration?.email_verification"
        :notice="notice"
        :resent="resent"
        :busy="busy"
        :error="error"
        :name-message="nameMessage"
        @name-input="checkName"
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
            :admin="admin"
            @open="(slug) => router.push(`/${slug}`)"
            @theme="setTheme"
            @sign-out="leave"
          />
        </template>
        <template #side>
          <PynSideNav
            :account="user"
            :items="navItems(admin)"
            :current="activeNav(route.path)"
            :repos="repos"
            :current-repo="currentRepo"
            :orgs="orgs"
            :current-org="currentOrg"
          />
        </template>
        <RouterView />
      </PynShell>
    </template>
  </div>
</template>
