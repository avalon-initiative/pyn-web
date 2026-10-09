<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'
import { createInvite, listInvites, listRoles, revokeInvite } from '../api/repos'
import PynInvites from '../components/PynInvites.vue'
import { useAction } from '../state/action.state'
import { repoKey } from '../state/context.state'
import type { InviteInfo } from '../types/repo.types'

const { target } = inject(repoKey)!
const invites = ref<InviteInfo[]>([])
const roles = ref<string[]>([])
const code = ref('')
const loaded = ref(false)
const { busy, error, attempt } = useAction()

async function load() {
  invites.value = await listInvites(target.value)
  roles.value = (await listRoles(target.value)).map((g) => g.role)
}

const create = (f: { role: string; hours: number }) =>
  attempt(async () => {
    code.value = (await createInvite(target.value, f.role, f.hours)).code
    await load()
  })

const revoke = (id: string) =>
  attempt(async () => {
    await revokeInvite(target.value, id)
    await load()
  })

onMounted(async () => {
  await attempt(load)
  loaded.value = true
})
</script>

<template>
  <PynInvites
    v-if="loaded"
    :invites="invites"
    :roles="roles"
    :code="code"
    :busy="busy"
    :error="error"
    @create="create"
    @revoke="revoke"
  />
  <p v-else-if="error" role="alert">{{ error }}</p>
</template>
