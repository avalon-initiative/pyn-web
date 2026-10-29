<script setup lang="ts">
import {
  PynTeamForm,
  PynTeamList,
  isOrgOwner,
  teamPath,
  type TeamFormValue,
  PynViewError,
} from '@avalon-initiative/pyn-common-ui'
import { inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createTeam, listTeams } from '../api/teams'
import { useAction } from '../state/action.state'
import { orgKey } from '../state/context.state'
import { canWrite } from '../state/freeze.state'
import type { TeamInfo } from '@avalon-initiative/pyn-common-ui'

const { name, org, frozen } = inject(orgKey)!
const router = useRouter()
const teams = ref<TeamInfo[]>([])
const loaded = ref(false)
const list = useAction()
const create = useAction()

const load = async () => {
  teams.value = await listTeams(name.value)
}

const submit = (t: TeamFormValue) =>
  create.attempt(async () => {
    const made = await createTeam(name.value, {
      slug: t.slug ?? '',
      name: t.name || undefined,
      description: t.description || undefined,
    })
    await router.push(teamPath(name.value, made.slug))
  })

onMounted(async () => {
  await list.attempt(load)
  loaded.value = true
})
</script>

<template>
  <PynTeamList v-if="loaded" :org="name" :teams="teams" />
  <PynViewError v-else-if="list.error.value">{{ list.error.value }}</PynViewError>
  <PynTeamForm
    v-if="loaded && canWrite(isOrgOwner(org), frozen)"
    :busy="create.busy.value"
    :error="create.error.value"
    @submit="submit"
  />
</template>
