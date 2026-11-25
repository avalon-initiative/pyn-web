<script setup lang="ts">
import {
  PynRepoForm,
  PynSettingsToggle,
  type RepoSettings,
  repoPath,
  ownerChoices,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listMyOrgs } from '../api/orgs'
import { createRepo } from '../api/repos'
import { refreshRepos } from '../state/session-data.state'
import { useAction } from '../state/action.state'
import { sessionKey } from '../state/context.state'
import { canonicalName, describeRepoNameError } from '../state/name.state'
import { suggestRepoName } from '../state/repo-suggestion.state'
import type { OrgInfo } from '@avalon-initiative/pyn-common-ui'

const user = inject(sessionKey)!.user
const route = useRoute()
const router = useRouter()
const orgs = ref<OrgInfo[]>([])
const chosen = ref('')
const starterPolicy = ref(true)
const suggestion = suggestRepoName()
const owners = computed(() => ownerChoices(user.value, orgs.value))
// ?owner= preselects an owner the person may create under; anything else falls back to them.
const requested = computed(() => {
  const q = route.query.owner
  return typeof q === 'string' && owners.value.includes(q) ? q : ''
})
const owner = computed(() => chosen.value || requested.value || user.value)
const typed = ref('')
const nameCanonical = computed(() => (typed.value.trim() ? canonicalName(typed.value) : ''))
const sent = ref('')
const { busy, error, attempt } = useAction(true, (e) =>
  describeRepoNameError(e, owner.value, sent.value),
)

onMounted(() =>
  listMyOrgs().then(
    (o) => (orgs.value = o),
    () => undefined,
  ),
)

const create = (settings: RepoSettings) => {
  sent.value = canonicalName(settings.name)
  return attempt(async () => {
    const repo = await createRepo(
      owner.value,
      { ...settings, name: sent.value },
      starterPolicy.value,
    )
    void refreshRepos()
    await router.push(repoPath(repo))
  })
}
</script>

<template>
  <PynRepoForm
    steps
    title="Create a new repository"
    intro="Repositories contain a project's files and version history."
    :suggestion="suggestion"
    describable
    :owner="owner"
    :owners="owners"
    :busy="busy"
    :error="error"
    :name-canonical="nameCanonical"
    cancel-href="/"
    @name-input="typed = $event"
    @update:owner="chosen = $event"
    @submit="create"
  >
    <template #options>
      <PynSettingsToggle
        v-model="starterPolicy"
        title="Add a starter policy file"
        help="Creates .pyn/pyn.toml, the repository policy file, with locks for binary files."
      />
    </template>
  </PynRepoForm>
</template>
