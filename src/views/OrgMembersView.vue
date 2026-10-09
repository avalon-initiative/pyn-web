<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { addOrgMember, listOrgMembers, removeOrgMember, setOrgRole } from '../api/orgs'
import PynOrgMembers from '../components/PynOrgMembers.vue'
import { useAction } from '../state/action.state'
import { orgKey, sessionKey } from '../state/context.state'
import { isOrgOwner, orgPath } from '../state/org.state'
import type { NewOrgMember, OrgMember, OrgRole } from '../types/org.types'

const { name, org, reload } = inject(orgKey)!
const user = inject(sessionKey)!.user
const router = useRouter()
const members = ref<OrgMember[]>([])
const loaded = ref(false)
const { busy, error, attempt } = useAction()

const load = async () => {
  members.value = await listOrgMembers(name.value)
}

const add = (m: NewOrgMember) =>
  attempt(async () => {
    await addOrgMember(name.value, m)
    await load()
  })

const change = (c: { user: string; role: OrgRole }) =>
  attempt(async () => {
    await setOrgRole(name.value, c.user, c.role)
    await load()
    if (c.user === user.value) await reload()
  })

const remove = (target: string) =>
  attempt(async () => {
    await removeOrgMember(name.value, target)
    if (target === user.value) {
      await reload()
      await router.push(orgPath(name.value))
    } else await load()
  })

onMounted(async () => {
  await attempt(load)
  loaded.value = true
})
</script>

<template>
  <PynOrgMembers
    v-if="loaded"
    :members="members"
    :self="user"
    :owner="isOrgOwner(org)"
    :busy="busy"
    :error="error"
    @add="add"
    @set-role="change"
    @remove="remove"
  />
  <p v-else-if="error" role="alert">{{ error }}</p>
</template>
