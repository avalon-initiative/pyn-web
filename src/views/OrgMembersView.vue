<script setup lang="ts">
import {
  PynOrgMembers,
  PynOrgPendingInvitations,
  isOrgOwner,
  orgPath,
  type NewOrgMember,
  PynLoading,
  PynViewStack,
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
import { refreshOrgs } from '../state/session-data.state'
import type { OrgInvitation, OrgMember, OrgRole } from '@avalon-initiative/pyn-common-ui'

const { name, org, frozen, reload } = inject(orgKey)!
const user = inject(sessionKey)!.user
const router = useRouter()
const members = ref<OrgMember[]>([])
const invitations = ref<OrgInvitation[]>([])
const notice = ref('')
const loaded = ref(false)
const adding = ref(false)
const { busy, error, attempt } = useAction()

const owner = computed(() => isOrgOwner(org.value))
const canManage = computed(() => canWrite(owner.value, frozen.value))

const load = async () => {
  members.value = await listOrgMembers(name.value)
  if (owner.value) invitations.value = await listOrgInvitations(name.value)
}

const add = (m: NewOrgMember) =>
  attempt(async () => {
    const result = await addOrgMember(name.value, m)
    adding.value = false
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
      void refreshOrgs()
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
  <PynViewStack>
    <PynLoading v-if="!loaded && !error" />
    <PynOrgMembers
      v-if="loaded"
      v-model:adding="adding"
      :members="members"
      :self="user"
      :owner="canManage"
      :busy="busy"
      :error="error"
      :notice="notice"
      @add="add"
      @set-role="change"
      @remove="remove"
    />
    <PynOrgPendingInvitations
      v-if="loaded && owner"
      :invitations="invitations"
      :readonly="!canManage"
      :busy="busy"
      @cancel="cancel"
    />
    <p v-else-if="error" role="alert">{{ error }}</p>
  </PynViewStack>
</template>
