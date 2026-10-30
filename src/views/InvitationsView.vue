<script setup lang="ts">
import {
  PynOrgInvitations,
  PynViewError,
  PynViewHeader,
  orgPath,
} from '@avalon-initiative/pyn-common-ui'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { acceptInvitation, declineInvitation, listMyInvitations } from '../api/orgs'
import { useAction } from '../state/action.state'
import { pendingInvitations } from '../state/invitations.state'
import type { OrgInvitation } from '@avalon-initiative/pyn-common-ui'

const router = useRouter()
const invitations = ref<OrgInvitation[]>([])
const loaded = ref(false)
const busyOrg = ref('')
const { error, attempt } = useAction()

const load = async () => {
  invitations.value = await listMyInvitations()
  pendingInvitations.value = invitations.value.length
}

// A failed answer (limit reached, gone, frozen) leaves the list as the server now has it.
async function answer(org: string, action: () => Promise<void>) {
  busyOrg.value = org
  if (!(await attempt(action))) await load().catch(() => {})
  busyOrg.value = ''
}

const accept = (org: string) =>
  answer(org, async () => {
    await acceptInvitation(org)
    await router.push(orgPath(org))
  })

const decline = (org: string) =>
  answer(org, async () => {
    await declineInvitation(org)
    await load()
  })

onMounted(async () => {
  await attempt(load)
  loaded.value = true
})
</script>

<template>
  <PynViewHeader title="Invitations" />
  <PynViewError v-if="error && !loaded">{{ error }}</PynViewError>
  <PynOrgInvitations
    v-else-if="loaded"
    :invitations="invitations"
    :busy-org="busyOrg"
    :error="error"
    @accept="accept"
    @decline="decline"
  />
</template>
