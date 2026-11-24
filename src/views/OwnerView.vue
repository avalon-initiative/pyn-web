<script setup lang="ts">
import {
  PynButton,
  PynEmptyState,
  PynOrgHome,
  PynProfileHeader,
  PynProfileLayout,
  PynReadme,
  PynRepoList,
  PynSignInPrompt,
  PynViewAction,
  PynViewError,
  PynLoading,
  orgPath,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listOrgMembers } from '../api/orgs'
import { getProfile, listStarred } from '../api/profile'
import type { PublicProfile } from '../api/profile'
import { fetchContent, fetchTree, listRepos } from '../api/repos'
import { useAction } from '../state/action.state'
import { orgKey, sessionKey } from '../state/context.state'
import { loadProfileReadme, peopleOf } from '../state/profile-readme.state'
import { refusedSignedOut } from '../state/public.state'
import { sortRepos } from '../state/repo.state'
import OwnerUsagePanel from './OwnerUsagePanel.vue'
import type { PersonEntry, ReadmeDoc, RepoInfo } from '@avalon-initiative/pyn-common-ui'

const { name, org } = inject(orgKey)!
const self = inject(sessionKey)!.user
const router = useRouter()
const route = useRoute()
const repos = ref<RepoInfo[]>([])
const starred = ref<RepoInfo[] | undefined>()
const people = ref<PersonEntry[]>([])
const readme = ref<ReadmeDoc | null>(null)
const profile = ref<PublicProfile | null>(null)
const loaded = ref(false)
// A signed-out miss reads the same for a private, an organization and a missing name.
const gated = ref(false)
const { error, attempt } = useAction()
const mine = computed(() => (org.value ? org.value.role === 'owner' : name.value === self.value))
const current = computed(() => {
  const view = String(route.name ?? '').replace(/^owner-?/, '')
  return view === 'repositories' || view === 'stars' || view === 'usage' ? view : ''
})
const newRepo = computed(() => `/_/new?owner=${encodeURIComponent(name.value)}`)
const readers = { tree: fetchTree, content: fetchContent }

// An organization's page is its home; a user's is the profile.
watch(
  name,
  async () => {
    loaded.value = false
    gated.value = false
    profile.value = null
    starred.value = undefined
    people.value = []
    readme.value = null
    await attempt(async () => {
      try {
        if (org.value) {
          repos.value = sortRepos(await listRepos(name.value))
          if (org.value.role)
            people.value = peopleOf(await listOrgMembers(name.value).catch(() => []))
        } else {
          profile.value = await getProfile(name.value)
          repos.value = sortRepos(profile.value.repositories)
          starred.value = (await listStarred(name.value).catch(() => null))?.map((s) => s.repo)
        }
        readme.value = await loadProfileReadme(name.value, repos.value, readers)
      } catch (e) {
        if (!self.value && refusedSignedOut(e)) gated.value = true
        else throw e
      }
    })
    loaded.value = true
  },
  { immediate: true },
)
</script>

<template>
  <PynViewError v-if="error">{{ error }}</PynViewError>
  <PynSignInPrompt
    v-else-if="gated"
    message="Sign in to see this page, or check the address."
    sign-in-href="/"
  />
  <PynLoading v-else-if="!loaded" />
  <template v-else>
    <PynProfileLayout
      v-if="profile"
      :username="profile.user"
      :current="current"
      :self="profile.user === self"
      :stars="starred?.length"
      :starred-repos="starred"
      :repos="repos"
      :orgs="profile.organizations"
    >
      <template #profile>
        <PynProfileHeader
          column
          :username="profile.user"
          :display-name="profile.profile.display_name"
          :avatar-url="profile.profile.avatar_url"
          :bio="profile.profile.bio"
          :location="profile.profile.location"
          :company="profile.profile.company"
          :links="profile.profile.links"
          :created-at="profile.created_at"
        >
          <template v-if="profile.user === self" #actions>
            <PynButton
              label="Edit profile"
              variant="secondary"
              @click="router.push('/_/settings/profile')"
            />
          </template>
        </PynProfileHeader>
      </template>
      <template v-if="readme" #readme>
        <PynReadme :readme="readme" :owner="name" :name="name" />
      </template>
      <template v-if="current === 'usage'" #default>
        <OwnerUsagePanel />
      </template>
      <template v-if="!repos.length" #repositories>
        <PynEmptyState
          compact
          :heading-level="3"
          :title="mine ? 'You have no repositories yet' : `${name} has no repositories you can see`"
          :primary-label="mine ? 'Create a repository' : undefined"
          :primary-href="mine ? '/_/new' : undefined"
        />
      </template>
    </PynProfileLayout>
    <PynOrgHome
      v-else-if="!current"
      :repos="repos"
      :people="people"
      :people-href="org?.role ? orgPath(name, 'members') : undefined"
    >
      <template v-if="readme" #readme>
        <PynReadme :readme="readme" :owner="name" :name="name" />
      </template>
      <template v-if="mine && repos.length" #repositoryActions>
        <PynViewAction :href="newRepo" primary>New repository</PynViewAction>
      </template>
      <template v-if="!repos.length" #repositories>
        <PynEmptyState
          compact
          :heading-level="3"
          :title="
            mine
              ? 'This organization has no repositories yet'
              : `${name} has no repositories you can see`
          "
          :primary-label="mine ? 'Create a repository' : undefined"
          :primary-href="mine ? `/_/new?owner=${encodeURIComponent(name)}` : undefined"
        />
      </template>
    </PynOrgHome>
    <PynRepoList v-else-if="repos.length" boxed :repos="repos">
      <template v-if="mine" #actions>
        <PynViewAction :href="newRepo" primary>New repository</PynViewAction>
      </template>
    </PynRepoList>
    <PynEmptyState
      v-else
      :title="
        mine
          ? 'This organization has no repositories yet'
          : `${name} has no repositories you can see`
      "
      :primary-label="mine ? 'Create a repository' : undefined"
      :primary-href="mine ? `/_/new?owner=${encodeURIComponent(name)}` : undefined"
    />
  </template>
</template>
