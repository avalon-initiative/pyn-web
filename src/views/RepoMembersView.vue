<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'
import { addUser, listMembers, listRoles, setMember } from '../api/repos'
import PynMembers from '../components/PynMembers.vue'
import { useAction } from '../state/action.state'
import { repoKey } from '../state/context.state'
import type { Member, NewUser } from '../types/repo.types'

const { target } = inject(repoKey)!
const members = ref<Member[]>([])
const roles = ref<string[]>([])
const loaded = ref(false)
const { busy, error, attempt } = useAction()

async function load() {
  members.value = await listMembers(target.value)
  roles.value = (await listRoles(target.value)).map((g) => g.role)
}

const change = (c: { user: string; role: string }) =>
  attempt(async () => {
    await setMember(target.value, c.user, c.role)
    await load()
  })

const add = (u: NewUser) =>
  attempt(async () => {
    await addUser(target.value, u)
    await load()
  })

onMounted(async () => {
  await attempt(load)
  loaded.value = true
})
</script>

<template>
  <PynMembers
    v-if="loaded"
    :members="members"
    :roles="roles"
    :busy="busy"
    :error="error"
    @set-role="change"
    @add-user="add"
  />
  <p v-else-if="error" role="alert">{{ error }}</p>
</template>
