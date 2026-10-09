<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getOrg } from '../api/orgs'
import { ApiError } from '../api/client'
import PynOrgHeader from '../components/PynOrgHeader.vue'
import PynPageNotFound from '../components/PynPageNotFound.vue'
import { useAction } from '../state/action.state'
import { orgKey } from '../state/context.state'
import styles from '../styles/View.module.scss'
import type { OrgInfo } from '../types/org.types'

const route = useRoute()
const name = computed(() => String(route.params.owner))
const section = computed(() => String(route.path.split('/')[3] ?? ''))
const org = ref<OrgInfo | null>(null)
const loaded = ref(false)
const { error, attempt } = useAction()

// A name that is not an organization is a user: only the profile page applies.
async function load() {
  return attempt(async () => {
    try {
      org.value = await getOrg(name.value)
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
    loaded.value = false
    await load()
    loaded.value = true
  },
  { immediate: true },
)

provide(orgKey, { name, org, reload: async () => void (await load()) })
</script>

<template>
  <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
  <template v-else-if="loaded">
    <template v-if="org">
      <PynOrgHeader
        :name="org.name"
        :created-at="org.created_at"
        :role="org.role"
        :current="section"
      />
      <RouterView />
    </template>
    <RouterView v-else-if="route.name === 'owner'" />
    <PynPageNotFound v-else />
  </template>
</template>
