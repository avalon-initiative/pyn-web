<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listIdentities, startLink, unlinkIdentity } from '../api/identities'
import { fetchSignInOptions } from '../api/auth'
import PynIdentities from '../components/PynIdentities.vue'
import { useAction } from '../state/action.state'
import type { ExternalIdentity, ExternalProvider } from '../types/auth.types'

const identities = ref<ExternalIdentity[]>([])
const provider = ref<ExternalProvider | null>(null)
const { busy, error, attempt } = useAction()

const load = () =>
  attempt(async () => {
    provider.value = (await fetchSignInOptions()).external ?? null
    identities.value = await listIdentities()
  })

const link = () =>
  attempt(async () => {
    window.location.assign(await startLink('/_/settings/identities'))
  })

const unlink = (id: string) =>
  attempt(async () => {
    await unlinkIdentity(id)
    identities.value = await listIdentities()
  })

onMounted(load)
</script>

<template>
  <PynIdentities
    v-if="provider"
    :identities="identities"
    :provider="provider"
    :busy="busy"
    :error="error"
    @link="link"
    @unlink="unlink"
  />
  <p v-else-if="error" role="alert">{{ error }}</p>
</template>
