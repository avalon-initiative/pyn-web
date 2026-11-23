<script setup lang="ts">
import { PynServerInvitations, PynViewHeader, PynViewStack } from '@avalon-initiative/pyn-common-ui'
import { computed, onMounted, ref } from 'vue'
import { createServerInvitation, listServerInvitations, revokeServerInvitation } from '../api/admin'
import { useAction } from '../state/action.state'
import { INVITATION_ROLES, invitationTargets } from '../state/server-invitations.state'
import { sessionOrgs, sessionRepos } from '../state/session-data.state'
import type { ServerInvitationCreate } from '@avalon-initiative/pyn-common-ui'
import type { ServerInvitation } from '../types/server-invitation.types'

const invitations = ref<ServerInvitation[]>([])
const created = ref('')
const emailed = ref(false)
const origin = window.location.origin
const action = useAction()
const targets = computed(() => invitationTargets(sessionRepos.value, sessionOrgs.value))

const load = () =>
  action.attempt(async () => {
    invitations.value = await listServerInvitations()
  })

const create = (body: ServerInvitationCreate) =>
  action.attempt(async () => {
    const made = await createServerInvitation(body)
    created.value = made.code
    emailed.value = made.emailed
    invitations.value = await listServerInvitations()
  })

// A failed revoke leaves the list as the server now has it.
const revoke = async (id: string) => {
  if (await action.attempt(() => revokeServerInvitation(id))) await load()
  else invitations.value = await listServerInvitations().catch(() => invitations.value)
}

onMounted(load)
</script>

<template>
  <PynViewStack>
    <PynViewHeader title="Invitations" />
    <PynServerInvitations
      :invitations="invitations"
      :created="created"
      :emailed="emailed"
      :server-url="origin"
      :targets="targets"
      :roles="INVITATION_ROLES"
      :busy="action.busy.value"
      :error="action.error.value"
      @create="create"
      @revoke="revoke"
      @dismiss="created = ''"
    />
  </PynViewStack>
</template>
