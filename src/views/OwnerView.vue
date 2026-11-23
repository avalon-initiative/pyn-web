<script setup lang="ts">
import {
  PynButton,
  PynEmptyState,
  PynProfileHeader,
  PynProfileLayout,
  PynRepoList,
  PynViewError,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getProfile } from '../api/profile'
import type { PublicProfile } from '../api/profile'
import { listRepos } from '../api/repos'
import { useAction } from '../state/action.state'
import { orgKey, sessionKey } from '../state/context.state'
import { sortRepos } from '../state/repo.state'
import type { RepoInfo } from '@avalon-initiative/pyn-common-ui'

const { name, org } = inject(orgKey)!
const self = inject(sessionKey)!.user
const router = useRouter()
const repos = ref<RepoInfo[]>([])
const profile = ref<PublicProfile | null>(null)
const loaded = ref(false)
const { error, attempt } = useAction()
const mine = computed(() => (org.value ? org.value.role === 'owner' : name.value === self.value))

// An organization's page lists its repositories; a user's is the profile.
watch(
  name,
  async () => {
    loaded.value = false
    profile.value = null
    await attempt(async () => {
      if (org.value) {
        repos.value = sortRepos(await listRepos(name.value))
      } else {
        profile.value = await getProfile(name.value)
        repos.value = sortRepos(profile.value.repositories)
      }
    })
    loaded.value = true
  },
  { immediate: true },
)
</script>

<template>
  <PynViewError v-if="error">{{ error }}</PynViewError>
  <template v-else-if="loaded">
    <PynProfileLayout v-if="profile" :repos="repos" :orgs="profile.organizations">
      <template #header>
        <PynProfileHeader
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
              label="Account settings"
              variant="secondary"
              @click="router.push('/_/settings')"
            />
          </template>
        </PynProfileHeader>
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
    <PynRepoList v-else-if="repos.length" :repos="repos" />
    <PynEmptyState
      v-else
      :title="
        mine
          ? 'This organization has no repositories yet'
          : `${name} has no repositories you can see`
      "
      :primary-label="mine ? 'Create a repository' : undefined"
      :primary-href="mine ? '/_/new' : undefined"
    />
  </template>
</template>
