<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../api/client'
import { listOrgMembers } from '../api/orgs'
import { addTeamMember, deleteTeam, getTeam, removeTeamMember, updateTeam } from '../api/teams'
import PynPageNotFound from '../components/PynPageNotFound.vue'
import PynTeamDelete from '../components/PynTeamDelete.vue'
import PynTeamDetail from '../components/PynTeamDetail.vue'
import PynTeamForm from '../components/PynTeamForm.vue'
import { useAction } from '../state/action.state'
import { orgKey } from '../state/context.state'
import { isOrgOwner } from '../state/org.state'
import { teamCandidates, teamPath } from '../state/team.state'
import styles from '../styles/View.module.scss'
import type { TeamFormValue, TeamInfo } from '../types/team.types'

const { name, org } = inject(orgKey)!
const route = useRoute()
const router = useRouter()
const slug = computed(() => String(route.params.team))
const team = ref<TeamInfo | null>(null)
const orgMembers = ref<string[]>([])
const loaded = ref(false)
const notFound = ref(false)
const owner = computed(() => isOrgOwner(org.value))
const page = useAction()
const members = useAction()
const edit = useAction()
const del = useAction()

const candidates = computed(() => teamCandidates(orgMembers.value, team.value?.members ?? []))

const load = async () => {
  try {
    team.value = await getTeam(name.value, slug.value)
  } catch (e) {
    if (e instanceof ApiError && e.code === 'team_not_found') notFound.value = true
    else throw e
  }
}

const loadMembers = async () => {
  if (owner.value) orgMembers.value = (await listOrgMembers(name.value)).map((m) => m.user)
}

const change = (action: () => Promise<void>) =>
  members.attempt(async () => {
    await action()
    await load()
  })

const add = (user: string) => change(() => addTeamMember(name.value, slug.value, user))
const remove = (user: string) => change(() => removeTeamMember(name.value, slug.value, user))

const save = (t: TeamFormValue) =>
  edit.attempt(async () => {
    await updateTeam(name.value, slug.value, { name: t.name, description: t.description })
    await load()
  })

const destroy = () =>
  del.attempt(async () => {
    await deleteTeam(name.value, slug.value)
    await router.push(teamPath(name.value))
  })

watch(
  slug,
  async () => {
    loaded.value = false
    notFound.value = false
    team.value = null
    await page.attempt(async () => {
      await load()
      await loadMembers()
    })
    loaded.value = true
  },
  { immediate: true },
)
</script>

<template>
  <p v-if="page.error.value" :class="styles.error" role="alert">{{ page.error.value }}</p>
  <PynPageNotFound v-else-if="loaded && notFound" />
  <template v-else-if="loaded && team">
    <PynTeamDetail
      :team="team"
      :candidates="candidates"
      :owner="owner"
      :busy="members.busy.value"
      :error="members.error.value"
      @add="add"
      @remove="remove"
    />
    <template v-if="owner">
      <PynTeamForm
        :key="team.slug"
        :team="team"
        :busy="edit.busy.value"
        :error="edit.error.value"
        @submit="save"
      />
      <PynTeamDelete
        :slug="team.slug"
        :busy="del.busy.value"
        :error="del.error.value"
        @remove="destroy"
      />
    </template>
  </template>
</template>
