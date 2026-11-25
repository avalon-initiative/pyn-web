<script setup lang="ts">
import {
  PynForkForm,
  PynViewSummary,
  ownerChoices,
  repoPath,
  type ForkFormValue,
  type OrgInfo,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listMyOrgs } from '../api/orgs'
import { forkRepo, updateRepo } from '../api/repos'
import { describeError } from '../api/client'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { canonicalName, describeRepoNameError } from '../state/name.state'
import { canFork } from '../state/repo-fork.state'
import { refreshRepos } from '../state/session-data.state'
import type { RepoDetails } from '../types/repo.types'

const { repo, target, branches } = inject(repoKey)!
const { user } = inject(sessionKey)!
const router = useRouter()
const orgs = ref<OrgInfo[]>([])
const chosen = ref('')
const owners = computed(() => ownerChoices(user.value, orgs.value))
const owner = computed(() => chosen.value || user.value)
const typed = ref('')
const nameCanonical = computed(() => (typed.value.trim() ? canonicalName(typed.value) : ''))
const defaultBranch = computed(() => branches.value.find((b) => b.isDefault)?.name)
const forkable = computed(() => !!repo.value && canFork(repo.value, !user.value))
const sent = ref({ owner: '', name: '' })
// A fork made before its description failed to save is not made again on the next submit.
const created = ref<RepoDetails | null>(null)
const { busy, error, attempt } = useAction(true, (e) =>
  created.value
    ? `Forked to ${created.value.owner}/${created.value.name}, but the description was not saved: ${describeError(e)}`
    : describeRepoNameError(e, sent.value.owner, sent.value.name),
)

onMounted(() =>
  listMyOrgs().then(
    (o) => (orgs.value = o),
    () => undefined,
  ),
)

const submit = (v: ForkFormValue) => {
  sent.value = { owner: v.owner, name: canonicalName(v.name) }
  return attempt(async () => {
    const fork =
      created.value ??
      (await forkRepo(target.value, {
        owner: v.owner,
        name: sent.value.name,
        default_branch_only: v.default_branch_only,
      }))
    created.value = fork
    void refreshRepos()
    if (v.description?.trim()) await updateRepo(fork, { description: v.description.trim() })
    await router.push(repoPath(fork))
  })
}
</script>

<template>
  <PynViewSummary v-if="repo && !forkable" data-not-forkable>
    The owner does not allow forks of this private repository.
  </PynViewSummary>
  <PynForkForm
    v-else-if="repo"
    :source="{ owner: repo.owner, name: repo.name }"
    :owner="owner"
    :owners="owners"
    :name="repo.name"
    :name-canonical="nameCanonical"
    :default-branch="defaultBranch"
    :busy="busy"
    :error="error"
    :cancel-href="repoPath(repo)"
    @update:owner="chosen = $event"
    @name-input="typed = $event"
    @submit="submit"
  />
</template>
