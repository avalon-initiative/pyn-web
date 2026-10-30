<script setup lang="ts">
import {
  PynOrgMembers,
  PynOrgPendingInvitations,
  isOrgOwner,
  orgPath,
  type NewOrgMember,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  addOrgMember,
  cancelOrgInvitation,
  listOrgInvitations,
  listOrgMembers,
  removeOrgMember,
  setOrgRole,
} from '../api/orgs'
import { useAction } from '../state/action.state'
import { orgKey, sessionKey } from '../state/context.state'
import { canWrite } from '../state/freeze.state'
import type { OrgInvitation, OrgMember, OrgRole } from '@avalon-initiative/pyn-common-ui'

const { name, org, frozen, reload } = inject(orgKey)!
const user = inject(sessionKey)!.user
const router = useRouter()
const members = ref<OrgMember[]>([])
const invitations = ref<OrgInvitation[]>([])
const notice = ref('')
const loaded = ref(false)
const { busy, error, attempt } = useAction()

const canManage = computed(() => canWrite(isOrgOwner(org.value), frozen.value))

const load = async () => {
  members.value = await listOrgMembers(name.value)
  if (canManage.value) invitations.value = await listOrgInvitations(name.value)
}

const add = (m: NewOrgMember) =>
  attempt(async () => {
    const result = await addOrgMember(name.value, m)
    notice.value =
      'invited' in result
        ? `Invited ${m.user}. They become a member once they accept.`
        : `Added ${m.user}.`
    await load()
  })

const cancel = (target: string) =>
  attempt(async () => {
    await cancelOrgInvitation(name.value, target)
    notice.value = ''
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
    :owner="canManage"
    :busy="busy"
    :error="error"
    @add="add"
    @set-role="change"
    @remove="remove"
  />
  <p v-if="loaded && notice" role="status">{{ notice }}</p>
  <PynOrgPendingInvitations
    v-if="loaded && canManage"
    :invitations="invitations"
    :busy="busy"
    @cancel="cancel"
  />
  <p v-else-if="error" role="alert">{{ error }}</p>
</template>
