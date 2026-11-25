<script setup lang="ts">
import {
  PynTeamDelete,
  PynTeamDetail,
  PynTeamForm,
  PynSettingsSection,
  isOrgOwner,
  teamCandidates,
  teamPath,
  type TeamFormValue,
  type TeamInfo,
  PynViewError,
  PynLoading,
} from '@avalon-initiative/pyn-common-ui'
import NotFoundView from './NotFoundView.vue'
import { computed, inject, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../api/client'
import { listOrgMembers } from '../api/orgs'
import { addTeamMember, deleteTeam, getTeam, removeTeamMember, updateTeam } from '../api/teams'
import { useAction } from '../state/action.state'
import { orgKey } from '../state/context.state'
import { canWrite } from '../state/freeze.state'

const { name, org, frozen } = inject(orgKey)!
const route = useRoute()
const router = useRouter()
const slug = computed(() => String(route.params.team))
const team = ref<TeamInfo | null>(null)
const orgMembers = ref<string[]>([])
const loaded = ref(false)
const adding = ref(false)
const notFound = ref(false)
const owner = computed(() => canWrite(isOrgOwner(org.value), frozen.value))
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

const add = (user: string) =>
  change(async () => {
    await addTeamMember(name.value, slug.value, user)
    adding.value = false
  })
const remove = (user: string) => change(() => removeTeamMember(name.value, slug.value, user))

const removeMany = (users: string[]) =>
  change(async () => {
    for (const u of users) await removeTeamMember(name.value, slug.value, u)
  })

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
  <PynViewError v-if="page.error.value">{{ page.error.value }}</PynViewError>
  <PynLoading v-else-if="!loaded" />
  <NotFoundView v-else-if="notFound" />
  <template v-else-if="loaded && team">
    <PynTeamDetail
      :key="team.id"
      v-model:adding="adding"
      :team="team"
      :candidates="candidates"
      :owner="owner"
      :busy="members.busy.value"
      :error="members.error.value"
      @add="add"
      @remove="remove"
      @remove-many="removeMany"
    />
    <template v-if="owner">
      <PynTeamForm
        :key="team.id"
        :team="team"
        :busy="edit.busy.value"
        :error="edit.error.value"
        @submit="save"
      />
      <PynSettingsSection title="Danger zone" danger plain>
        <PynTeamDelete
          :key="team.id"
          :slug="team.slug"
          :busy="del.busy.value"
          :error="del.error.value"
          @remove="destroy"
        />
      </PynSettingsSection>
    </template>
  </template>
</template>
