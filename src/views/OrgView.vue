<script setup lang="ts">
import {
  PynOrgHeader,
  PynOwnerFrozenNotice,
  PynUserHeader,
  PynViewError,
} from '@avalon-initiative/pyn-common-ui'
import NotFoundView from './NotFoundView.vue'
import { computed, inject, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getOrg, getOrgProfile, getOwnerFreeze } from '../api/orgs'
import { ApiError } from '../api/client'
import { useAction } from '../state/action.state'
import { orgKey, sessionKey } from '../state/context.state'
import { useOwnerFreeze } from '../state/freeze.state'
import type { OrgInfo } from '@avalon-initiative/pyn-common-ui'
import type { Schemas } from '../api/schema'

const route = useRoute()
const name = computed(() => String(route.params.owner))
const user = inject(sessionKey)!.user
const section = computed(() => String(route.path.split('/')[3] ?? ''))
const org = ref<OrgInfo | null>(null)
const { freeze, frozen } = useOwnerFreeze(name, (o) =>
  user.value ? getOwnerFreeze(o) : Promise.reject(new Error('signed out')),
)
const profile = ref<Schemas['OrgProfile'] | null>(null)
const loaded = ref(false)
const userPage = computed(() => route.name === 'owner' || route.name === 'owner-usage')
const { error, attempt } = useAction()

// A name that is not an organization is a user: only the profile page applies.
async function load() {
  // Organization lookups need an account: signed out, every name is shown as a user's page.
  if (!user.value) return
  return attempt(async () => {
    try {
      org.value = await getOrg(name.value)
      // The profile only decorates the header: without it the name stands alone.
      profile.value = await getOrgProfile(name.value).catch(() => null)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'org_not_found') org.value = null
      else throw e
    }
  })
}

watch(
  name,
  async () => {
    org.value = null
    profile.value = null
    loaded.value = false
    await load()
    loaded.value = true
  },
  { immediate: true },
)

provide(orgKey, { name, org, frozen, reload: async () => void (await load()) })
</script>

<template>
  <PynViewError v-if="error">{{ error }}</PynViewError>
  <template v-else-if="loaded">
    <PynOwnerFrozenNotice v-if="freeze && (org || userPage)" :freeze="freeze" />
    <template v-if="org">
      <PynOrgHeader
        :name="org.name"
        :created-at="org.created_at"
        :role="org.role"
        :current="section"
        :description="profile?.description"
        :avatar-url="profile?.avatar_url"
        :max-tabs="6"
      />
      <RouterView />
    </template>
    <template v-else-if="userPage">
      <PynUserHeader
        :name="name"
        :self="name === user"
        :current="section === 'usage' ? 'usage' : ''"
      />
      <RouterView />
    </template>
    <NotFoundView v-else />
  </template>
</template>
