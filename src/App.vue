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
import { blockedStatus } from './state/account.state'
import { paletteKey, sessionKey } from './state/context.state'
import { freshPrompt } from './state/fresh.state'
import {
  SECURITY_PATH,
  needsSecondFactor,
  onEnrolmentRequired,
  twoFactorDue,
} from './state/two-factor.state'
import { getPasskey, passkeyBrowserError, passkeysSupported } from './state/webauthn.state'
import { passwordChangeRequired } from './state/password-change.state'
import { onPendingDeletion } from './state/pending.state'
import { ownProfile } from './state/own-profile.state'
import { ownAccessSessions } from './state/access-session.state'
import { canonicalName, describeNameError, nameProblem, useNameCheck } from './state/name.state'
import { rememberedUser, rememberUser } from './state/remember.state'
import { internalPath } from './state/links.state'
import {
  clearSessionData,
  sessionOrgs,
  sessionRepos,
  startSessionRefresh,
} from './state/session-data.state'
import {
  loadTopBar,
  resetTopBar,
  topBarExtras,
  topBarOwners,
  bellActions,
  useTopBar,
} from './state/top-bar.state'
import { recentItems, setRecentUser } from './state/recent.state'
import { useTopBarSearch } from './state/top-bar-search.state'
import { usePalette } from './state/palette.state'
import { breadcrumbs } from './state/breadcrumbs.state'
import {
  dismissSecurityNotice,
  loadSecurityNotice,
  resetSecurityNotice,
  securityNotice,
} from './state/security-notice.state'
import { selectAccountItem } from './state/extension.state'
import type { AccountMenuItem } from './types/extension.types'
import {
  PynAccessSessionBanner,
  PynAccountPendingDeletion,
  PynCommandPalette,
  PynShell,
  PynSideRail,
  PynShortcutsHelp,
  PynSecondFactor,
  PynSignIn,
  PynTopBar,
  PynVersionFooter,
  PynSecurityNotice,
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
import { helpHint, recoveryHint } from './state/two-factor.state'
import type { RegistrationInfo, Session, SignInOptions } from './types/auth.types'

const props = withDefaults(
  defineProps<{ navItems?: NavItem[]; accountMenuItems?: AccountMenuItem[] }>(),
  {
    navItems: () => [],
    accountMenuItems: () => [],
  },
)
const router = useRouter()
const route = useRoute()
const user = ref('')
const admin = ref(false)
const error = ref('')
const serverBuild = ref<ServerBuild | null>(null)
const serverOutdated = computed(() => serverTooOld(serverBuild.value?.version))
const { nameMessage, nameCanonical, checkName } = useNameCheck()
const remember = ref(!!rememberedUser())
const STAY_SIGNED_IN = true
const staySignedIn = ref(false)
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

const accessMode = ref<string>()
const signInRequested = ref(false)
// A private server refuses every signed-out read, so its public pages would only show errors.
const publicPage = computed(
  () => accessMode.value !== 'private' && route.matched.some((r) => r.meta.public === true),
)
watch(
  () => route.fullPath,
  () => (signInRequested.value = false),
)
const trail = computed(() => breadcrumbs(route))
const wide = computed(() => route.matched.some((r) => r.meta.wide === true))
const onDashboard = computed(() => route.name === 'dashboard')
const railItems: NavItem[] = [{ id: 'home', label: 'Home', href: '/' }]
const exploreLinks = [{ id: 'explore', label: 'Explore', href: '/_/explore' }]
const slugs = computed(() => sessionRepos.value.map(repoSlug))
const owners = computed(() => topBarOwners(user.value, sessionOrgs.value))
const extras = computed(() => topBarExtras(props.navItems, props.accountMenuItems))
const { locksHeld, locksExpiring, bellEntries } = useTopBar()
const topSearch = useTopBarSearch(sessionRepos, sessionOrgs)
const bell = bellActions((path) => router.push(path))
const currentOwner = computed(() => {
  const owner = String(route.params.owner ?? '')
  return owners.value.some((o) => o.name === owner) ? owner : undefined
})

const currentRepo = computed(() => {
  const owner = String(route.params.owner ?? '')
  const name = String(route.params.name ?? '')
  return owner && name && route.name !== 'not-found' ? { owner, name } : null
})
const palette = usePalette({
  user,
  admin,
  repos: sessionRepos,
  orgs: sessionOrgs,
  recent: recentItems,
  repo: currentRepo,
  go: (path) => router.push(path),
})

function setTheme(choice: ThemeChoice) {
  theme.value = choice
  applyTheme(choice)
  saveTheme(choice)
}

let stopRefresh = () => {}
watch(user, (name) => {
  setRecentUser(name ?? '')
  stopRefresh()
  if (name) {
    stopRefresh = startSessionRefresh()
    void loadTopBar()
  } else {
    stopRefresh = () => {}
    clearSessionData()
    resetTopBar()
  }
})
onUnmounted(() => stopRefresh())

const expire = () => {
  twoFactorDue.value = null
  resetSecurityNotice()
  challenge.value = null
  deletion.value = null
  user.value = ''
  admin.value = false
  passwordChangeRequired.value = false
  ownProfile.value = {}
}
provide(paletteKey, { show: palette.show })
provide(sessionKey, {
  requestSignIn: () => (signInRequested.value = true),
  user,
  admin,
  expire,
  recoveryDays,
  scheduled: (status) => (deletion.value = status),
})

/** Reads the admin flag before the user is set, so admin pages do not flash as not found. */
async function begin(name: string, mustChangePassword?: boolean) {
  if (mustChangePassword !== undefined) passwordChangeRequired.value = mustChangePassword
  const status = await fetchDeletionStatus().catch(() => null)
  recoveryDays.value = status?.window_days
  deletion.value = status?.pending ? status : null
  const me = deletion.value ? null : await fetchMe().catch(() => null)
  admin.value = me?.admin === true
  twoFactorDue.value = me?.two_factor_required ?? null
  ownProfile.value = me?.profile ?? {}
  user.value = name
  setupUsername.value = ''
  if (!deletion.value) void loadSecurityNotice()
  if (passwordChangeRequired.value) await router.push({ name: 'password' })
}

const beginSession = (s: Session) => begin(s.user, s.password_change_required === true)

const typedName = ref('')
async function attempt(action: () => Promise<void>) {
  busy.value = true
  error.value = ''
  try {
    await action()
  } catch (e) {
    const status = blockedStatus(e)
    if (status) notice.value = { status, user: pendingUser.value }
    else error.value = describeNameError(e, typedName.value)
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
    typedName.value = canonicalName(form.username)
    const username = typedName.value
    await completeSetup({ ...form, username })
    setupUsername.value = username
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
      await beginSession(await signIn(form))
      rememberUser(form.username, remember.value)
    } catch (e) {
      if (!needsSecondFactor(e)) throw e
      challenge.value = form
    }
  })

const submitChallenge = (second: SecondFactorForm) =>
  attempt(async () => {
    if (!challenge.value) return
    await beginSession(await signIn(challenge.value, second.code.trim()))
    rememberUser(challenge.value.username, remember.value)
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
      const session = await finishPasskeySignIn(
        begun.ceremony,
        await getPasskey(begun.public_key),
        staySignedIn.value,
      )
      challenge.value = null
      await beginSession(session)
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
    typedName.value = canonicalName(form.username)
    const named = { ...form, username: typedName.value }
    pendingUser.value = named.username
    const { status } = await register(named)
    if (status === 'active') await beginSession(await signIn(named))
    else
      notice.value = {
        status: status === 'disabled' ? 'account_disabled' : status,
        user: named.username,
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
  if (
    !user.value &&
    (e.target as Element | null)?.closest?.('[data-sign-in]') &&
    publicPage.value
  ) {
    e.preventDefault()
    signInRequested.value = true
    return
  }
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
  accessMode.value = status?.access_mode
  await loadOptions()
  const session = await restoreSession().catch(() => null)
  if (session) await beginSession(session)
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
    <PynShell
      v-else-if="ready && !user && publicPage && !signInRequested"
      :breadcrumbs="trail"
      :wide="wide"
    >
      <template #top>
        <PynTopBar
          signed-out
          sign-in-href="/"
          :theme="theme"
          @theme="setTheme"
          @open="(slug) => router.push(`/${slug}`)"
        />
      </template>
      <RouterView />
    </PynShell>
    <main v-else-if="ready && !user">
      <RouterView v-if="route.name === 'verify-email'" />
      <PynSecondFactor
        v-else-if="challenge"
        :recovery-hint="recoveryHint"
        :help-hint="helpHint"
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
        :initial-username="setupUsername || rememberedUser() || undefined"
        :callback-error="callbackError"
        :email-verification="registration?.email_verification"
        :notice="notice"
        :resent="resent"
        :busy="busy"
        :error="error"
        v-model:remember="remember"
        v-model:stay-signed-in="staySignedIn"
        remember-option
        :stay-signed-in-option="STAY_SIGNED_IN"
        :name-message="nameMessage"
        :name-canonical="nameCanonical"
        @dismiss-error="error = ''"
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
      <PynShell :breadcrumbs="trail" :wide="wide">
        <template v-if="onDashboard" #side>
          <PynSideRail
            :account="user"
            :display-name="ownProfile.display_name"
            :avatar-url="ownProfile.avatar_url"
            :items="railItems"
            current="home"
            :repos="sessionRepos"
            :orgs="sessionOrgs"
            create-org-href="/_/new-org"
          />
        </template>
        <template #top>
          <PynTopBar
            :user="user"
            :display-name="ownProfile.display_name"
            :avatar-url="ownProfile.avatar_url"
            :repos="slugs"
            :theme="theme"
            :admin="admin"
            :extra-account="extras"
            :extra-links="exploreLinks"
            :owners="owners"
            :current-owner="currentOwner"
            :repo="currentRepo?.name"
            :locks-held="locksHeld"
            :locks-expiring="locksExpiring"
            :notification-entries="bellEntries"
            :search-results="topSearch.results.value"
            @dismiss-notification="bell.dismiss"
            @accept-notification="bell.accept"
            @decline-notification="bell.decline"
            @account="(id) => selectAccountItem(extras, id)"
            @open="(slug) => router.push(`/${slug}`)"
            @input="topSearch.input"
            @search="palette.show"
            @shortcuts="palette.showHelp"
            @theme="setTheme"
            @sign-out="leave"
          />
        </template>
        <PynSecurityNotice
          v-if="securityNotice && route.path !== SECURITY_PATH"
          v-bind="securityNotice"
          @dismiss="dismissSecurityNotice"
        />
        <PynSecondFactor
          v-if="freshPrompt"
          :recovery-hint="recoveryHint"
          :help-hint="helpHint"
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
          <RouterView />
        </template>
        <PynCommandPalette
          :open="palette.open.value"
          :items="palette.items.value"
          :loading="palette.loading.value"
          :initial-text="palette.text.value"
          label="Command palette"
          placeholder="Search repositories, people and pages"
          unfiltered
          @input="palette.input"
          @select="palette.select"
          @close="palette.close"
        />
        <PynShortcutsHelp
          :open="palette.helpOpen.value"
          :groups="palette.help.value"
          label="Keyboard shortcuts"
          @close="palette.helpOpen.value = false"
        />
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
