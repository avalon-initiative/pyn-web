<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { addUser, listMembers, listRoles, setMember } from '../api/repos'
import { listTeams, listRepoTeams, removeRepoTeam, setRepoTeam } from '../api/teams'
import PynAddPerson from '../components/PynAddPerson.vue'
import PynMembers from '../components/PynMembers.vue'
import PynTeamGrant from '../components/PynTeamGrant.vue'
import { useAction } from '../state/action.state'
import { repoKey } from '../state/context.state'
import { personGrantees, teamGrantees, ungrantedTeams } from '../state/team.state'
import type { Member, NewUser } from '../types/repo.types'
import type { RepoTeam, TeamInfo } from '../types/team.types'

const { target, permissions, org } = inject(repoKey)!
const members = ref<Member[]>([])
const roles = ref<string[]>([])
const granted = ref<RepoTeam[]>([])
const orgTeams = ref<TeamInfo[]>([])
const loaded = ref(false)
const people = useAction()
const adding = useAction()
const teams = useAction()
const granting = useAction()

const showTeams = computed(() => org.value !== null && permissions.value.includes('manage_users'))

async function loadPeople() {
  members.value = await listMembers(target.value)
  roles.value = (await listRoles(target.value)).map((g) => g.role)
}

async function loadTeams() {
  if (!showTeams.value) return
  granted.value = await listRepoTeams(target.value)
  orgTeams.value = await listTeams(target.value.owner)
}

const reload = async () => {
  await loadPeople()
  await loadTeams()
}

const change = (c: { name: string; role: string }) =>
  people.attempt(async () => {
    await setMember(target.value, c.name, c.role)
    await reload()
  })

const add = (u: NewUser) =>
  adding.attempt(async () => {
    await addUser(target.value, u)
    await reload()
  })

const grant = (c: { name: string; role: string }, state = teams) =>
  state.attempt(async () => {
    await setRepoTeam(target.value, c.name, c.role)
    await reload()
  })

const revoke = (slug: string) =>
  teams.attempt(async () => {
    await removeRepoTeam(target.value, slug)
    await reload()
  })

onMounted(async () => {
  await people.attempt(reload)
  loaded.value = true
})
</script>

<template>
  <template v-if="loaded">
    <PynMembers
      :grantees="personGrantees(members)"
      :roles="roles"
      :busy="people.busy.value"
      :error="people.error.value"
      @set-role="change"
    >
      <PynAddPerson
        :roles="roles"
        :busy="adding.busy.value"
        :error="adding.error.value"
        @add-user="add"
      />
    </PynMembers>
    <PynMembers
      v-if="showTeams"
      kind="team"
      title="Teams"
      revocable
      :grantees="teamGrantees(target.owner, granted)"
      :roles="roles"
      :busy="teams.busy.value"
      :error="teams.error.value"
      @set-role="grant"
      @revoke="revoke"
    >
      <PynTeamGrant
        :teams="ungrantedTeams(orgTeams, granted)"
        :roles="roles"
        :busy="granting.busy.value"
        :error="granting.error.value"
        @grant="(c) => grant(c, granting)"
      />
    </PynMembers>
  </template>
  <p v-else-if="people.error.value" role="alert">{{ people.error.value }}</p>
</template>
