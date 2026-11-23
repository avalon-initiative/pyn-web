<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
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
  beginPasskeySignIn,
  finishPasskeySignIn,
} from './api/auth'
import {
  beginPasskeyVerify,
  fetchTwoFactor,
  finishPasskeyVerify,
  verifySecondFactor,
} from './api/two-factor'
import { fetchMe } from './api/admin'
import { fetchDeletionStatus, restoreAccount } from './api/account-deletion'
import type { AccountDeletionStatus } from './api/account-deletion'
import { fetchServerBuild } from './api/server'
import { webRevision, webVersion } from './state/version.state'
import { minServerVersion, serverTooOld } from './state/server-compat.state'
import type { ServerBuild } from './types/version.types'
import { describeError } from './api/client'
import { blockedStatus } from './state/account.state'
import { sessionKey } from './state/context.state'
import { freshPrompt } from './state/fresh.state'
import {
  SECURITY_PATH,
  needsSecondFactor,
  onEnrolmentRequired,
  twoFactorDue,
} from './state/two-factor.state'
import { getPasskey, passkeyBrowserError, passkeysSupported } from './state/webauthn.state'
import { onPendingDeletion } from './state/pending.state'
import { ownProfile } from './state/own-profile.state'
import { ownAccessSessions } from './state/access-session.state'
import { pendingInvitations } from './state/invitations.state'
import { nameProblem, useNameCheck } from './state/name.state'
import { internalPath } from './state/links.state'
import {
  clearSessionData,
  sessionOrgs,
  sessionRepos,
  startSessionRefresh,
} from './state/session-data.state'
import { activeNav, sideNavItems } from './state/shell.state'
import { selectAccountItem } from './state/extension.state'
import type { AccountMenuItem } from './types/extension.types'
import {
  PynAccessSessionBanner,
  PynAccountPendingDeletion,
  PynShell,
  PynSecondFactor,
  PynSignIn,
  PynSideNav,
  PynTopBar,
  PynVersionFooter,
  PynTwoFactorNag,
  PynViewNotice,
  applyTheme,
  loadTheme,
  repoSlug,
  saveTheme,
  PynSetup,
} from '@avalon-initiative/pyn-common-ui'
import type { NavItem, ThemeChoice } from '@avalon-initiative/pyn-common-ui'
import type {
  BlockedStatus,
  RegisterForm,
  SetupForm,
  SetupStatus,
  SecondFactorForm,
  SignInForm,
} from '@avalon-initiative/pyn-common-ui'
import type { RegistrationInfo, SignInOptions } from './types/auth.types'

withDefaults(defineProps<{ navItems?: NavItem[]; accountMenuItems?: AccountMenuItem[] }>(), {
  navItems: () => [],
  accountMenuItems: () => [],
})
const router = useRouter()
const route = useRoute()
const user = ref('')
const admin = ref(false)
const error = ref('')
const serverBuild = ref<ServerBuild | null>(null)
const serverOutdated = computed(() => serverTooOld(serverBuild.value?.version))
const { nameMessage, checkName } = useNameCheck()
const busy = ref(false)
const registration = ref<RegistrationInfo | null>(null)
const signInOptions = ref<SignInOptions | null>(null)
const callbackError = new URLSearchParams(window.location.search).get('error') ?? ''
const notice = ref<{ status: BlockedStatus; user?: string } | null>(null)
const resent = ref(false)
const ready = ref(false)
const deletion = ref<AccountDeletionStatus | null>(null)
const recoveryDays = ref<number | undefined>()
const theme = ref<ThemeChoice>(loadTheme())
applyTheme(theme.value)

const publicPage = computed(() => route.matched.some((r) => r.meta.public === true))
const bare = computed(() => route.matched.some((r) => r.meta.bare === true))
const slugs = computed(() => sessionRepos.value.map(repoSlug))
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

let stopRefresh = () => {}
watch(user, (name) => {
  stopRefresh()
  if (name) stopRefresh = startSessionRefresh()
  else {
    stopRefresh = () => {}
    clearSessionData()
  }
})
onUnmounted(() => stopRefresh())

const expire = () => {
  twoFactorDue.value = null
  challenge.value = null
  deletion.value = null
  user.value = ''
  admin.value = false
  ownProfile.value = {}
}
provide(sessionKey, {
  user,
  admin,
  expire,
  recoveryDays,
  scheduled: (status) => (deletion.value = status),
})

/** Reads the admin flag before the user is set, so admin pages do not flash as not found. */
async function begin(name: string) {
  const status = await fetchDeletionStatus().catch(() => null)
  recoveryDays.value = status?.window_days
  deletion.value = status?.pending ? status : null
  const me = deletion.value ? null : await fetchMe().catch(() => null)
  admin.value = me?.admin === true
  twoFactorDue.value = me?.two_factor_required ?? null
  ownProfile.value = me?.profile ?? {}
  user.value = name
  setupUsername.value = ''
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

/** The sign-in page's options; an uninitialised server refuses them, so they are read again after setup. */
async function loadOptions() {
  registration.value = await fetchRegistration().catch(() => null)
  signInOptions.value = await fetchSignInOptions().catch(() => null)
}

const pendingUser = ref('')
const challenge = ref<SignInForm | null>(null)
const freshPasskeys = ref(false)
const passkeysOffered = computed(() => !!signInOptions.value?.passkeys && passkeysSupported())

/** Shows the format problem and returns true when the name cannot be valid. */
function refuseName(name: string): boolean {
  error.value = nameProblem(name)
  return error.value !== ''
}
const setup = ref<SetupStatus | null>(null)
const setupDone = ref(false)
const setupUsername = ref('')

const finishSetup = (form: SetupForm) =>
  attempt(async () => {
    if (refuseName(form.username)) return
    await completeSetup(form)
    setupUsername.value = form.username
    setupDone.value = true
  })

// Setup creates no session: leaving the wizard lands on the normal sign-in page, at `to` once signed in.
const leaveSetup = async (to?: string) => {
  setup.value = null
  setupDone.value = false
  await loadOptions()
  if (to) await router.push(to)
}

const submitSignIn = (form: SignInForm) =>
  attempt(async () => {
    pendingUser.value = form.username
    try {
      await begin((await signIn(form)).user)
    } catch (e) {
      if (!needsSecondFactor(e)) throw e
      challenge.value = form
    }
  })

const submitChallenge = (second: SecondFactorForm) =>
  attempt(async () => {
    if (!challenge.value) return
    await begin((await signIn(challenge.value, second.code.trim())).user)
    challenge.value = null
  })

/** Runs a passkey ceremony, turning a dismissed browser prompt into the error text. */
async function ceremony(run: () => Promise<void>) {
  try {
    await run()
  } catch (e) {
    const text = passkeyBrowserError(e)
    if (!text) throw e
    error.value = text
  }
}

const signInWithPasskey = () =>
  attempt(() =>
    ceremony(async () => {
      const begun = await beginPasskeySignIn(challenge.value?.username)
      const session = await finishPasskeySignIn(begun.ceremony, await getPasskey(begun.public_key))
      challenge.value = null
      await begin(session.user)
    }),
  )

const submitFresh = (second: SecondFactorForm) =>
  attempt(async () => {
    await verifySecondFactor(second.code.trim())
    freshPrompt.value?.settle(true)
  })

const freshWithPasskey = () =>
  attempt(() =>
    ceremony(async () => {
      const begun = await beginPasskeyVerify()
      await finishPasskeyVerify(begun.ceremony, await getPasskey(begun.public_key))
      freshPrompt.value?.settle(true)
    }),
  )

const cancelFresh = () => {
  error.value = ''
  freshPrompt.value?.settle(false)
}

watch(freshPrompt, async (prompt) => {
  freshPasskeys.value = false
  if (!prompt) return
  const status = await fetchTwoFactor().catch(() => null)
  freshPasskeys.value =
    !!status?.passkeys_available && (status.passkeys?.length ?? 0) > 0 && passkeysSupported()
})

onEnrolmentRequired(async () => {
  if (!twoFactorDue.value)
    twoFactorDue.value = (await fetchTwoFactor().catch(() => null))?.required ?? null
  if (route.path !== SECURITY_PATH) await router.push(SECURITY_PATH)
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

const restore = () =>
  attempt(async () => {
    await restoreAccount()
    deletion.value = null
    await begin(user.value)
  })

function dismissNotice() {
  notice.value = null
  resent.value = false
  error.value = ''
}

async function leave() {
  await signOut().catch(() => undefined)
  expire()
  await loadOptions()
  await router.push('/')
}

function followLink(e: MouseEvent) {
  const path = internalPath(e, window.location.origin)
  if (path === null) return
  e.preventDefault()
  router.push(path)
}

onPendingDeletion(async () => {
  if (user.value && !deletion.value) {
    const status = await fetchDeletionStatus().catch(() => null)
    if (status?.pending) deletion.value = status
  }
})
onUnmounted(() => {
  onPendingDeletion(null)
  onEnrolmentRequired(null)
})

onMounted(async () => {
  void fetchServerBuild().then((b) => (serverBuild.value = b))
  const status = await fetchSetupStatus().catch(() => null)
  if (status && !status.initialised) setup.value = status
  await loadOptions()
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
        :done="setupDone"
        :busy="busy"
        :error="error"
        :name-message="nameMessage"
        suggest-second-admin
        @name-input="checkName"
        @finish="finishSetup"
        @sign-in="leaveSetup()"
        @manage-admins="leaveSetup('/_/admin/accounts')"
      />
    </main>
    <PynShell v-else-if="ready && !user && publicPage" bare>
      <template #top>
        <PynTopBar signed-out sign-in-href="/" :theme="theme" @theme="setTheme" />
      </template>
      <RouterView />
    </PynShell>
    <main v-else-if="ready && !user">
      <RouterView v-if="route.name === 'verify-email'" />
      <PynSecondFactor
        v-else-if="challenge"
        :passkeys="passkeysOffered"
        :busy="busy"
        :error="error"
        @submit="submitChallenge"
        @passkey="signInWithPasskey"
        @cancel="((challenge = null), dismissNotice())"
      />
      <PynSignIn
        v-else
        :registration="registration?.registration ?? null"
        :external="signInOptions?.external"
        :password-sign-in="signInOptions?.password"
        :passkeys="passkeysOffered"
        :return-to="route.fullPath"
        :initial-username="setupUsername || undefined"
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
        @passkey="signInWithPasskey"
      />
    </main>
    <main v-else-if="user && deletion?.pending && deletion.purge_at">
      <PynAccountPendingDeletion
        :deadline="deletion.purge_at"
        :user="user"
        :busy="busy"
        :error="error"
        @restore="restore"
      />
    </main>
    <template v-else-if="user">
      <PynShell :bare="bare">
        <template #top>
          <PynTopBar
            :user="user"
            :display-name="ownProfile.display_name"
            :avatar-url="ownProfile.avatar_url"
            :repos="slugs"
            :theme="theme"
            :admin="admin"
            :extra-account="accountMenuItems"
            @account="(id) => selectAccountItem(accountMenuItems, id)"
            @open="(slug) => router.push(`/${slug}`)"
            @theme="setTheme"
            @sign-out="leave"
          />
        </template>
        <template v-if="!bare" #side>
          <PynSideNav
            :account="user"
            :display-name="ownProfile.display_name"
            :avatar-url="ownProfile.avatar_url"
            :items="sideNavItems(admin, navItems, pendingInvitations)"
            :current="activeNav(route.path, navItems)"
            :repos="sessionRepos"
            :current-repo="currentRepo"
            :orgs="sessionOrgs"
            :current-org="currentOrg"
          />
        </template>
        <PynSecondFactor
          v-if="freshPrompt"
          :passkeys="freshPasskeys"
          :busy="busy"
          :error="error"
          @submit="submitFresh"
          @passkey="freshWithPasskey"
          @cancel="cancelFresh"
        />
        <template v-else>
          <PynViewNotice v-if="serverOutdated" tone="warning" title="Server update recommended">
            This app needs pyn server {{ minServerVersion }} or newer; this server is
            {{ serverBuild?.version }}. Some pages may not work until it is updated.
          </PynViewNotice>
          <PynAccessSessionBanner :sessions="ownAccessSessions" />
          <PynTwoFactorNag
            v-if="twoFactorDue && route.path !== SECURITY_PATH"
            :required="twoFactorDue"
            :href="SECURITY_PATH"
          />
          <RouterView />
        </template>
        <template #footer>
          <PynVersionFooter
            :web-version="webVersion"
            :web-revision="webRevision"
            :server-version="serverBuild?.version"
            :server-revision="serverBuild?.revision"
          />
        </template>
      </PynShell>
    </template>
  </div>
</template>
