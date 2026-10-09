<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createTeam, listTeams } from '../api/teams'
import PynTeamForm from '../components/PynTeamForm.vue'
import PynTeamList from '../components/PynTeamList.vue'
import { useAction } from '../state/action.state'
import { orgKey } from '../state/context.state'
import { isOrgOwner } from '../state/org.state'
import { teamPath } from '../state/team.state'
import styles from '../styles/View.module.scss'
import type { TeamFormValue, TeamInfo } from '../types/team.types'

const { name, org } = inject(orgKey)!
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
  <p v-else-if="list.error.value" :class="styles.error" role="alert">{{ list.error.value }}</p>
  <PynTeamForm
    v-if="loaded && isOrgOwner(org)"
    :busy="create.busy.value"
    :error="create.error.value"
    @submit="submit"
  />
</template>
