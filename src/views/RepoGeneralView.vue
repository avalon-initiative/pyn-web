<script setup lang="ts">
import {
  PynButton,
  PynRepoDelete,
  PynRepoForm,
  PynSettingsSection,
  PynSettingsToggle,
  PynTextArea,
  PynTextField,
  PynViewError,
  type RepoFormValue,
  type RepoSettings,
  repoPath,
  repoSlug,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { deleteRepo, updateRepo } from '../api/repos'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { refreshRepos } from '../state/session-data.state'
import { isRepoOwner } from '../state/repo-access.state'
import {
  DESCRIPTION_MAX,
  aboutFields,
  aboutRequest,
  parseTopics,
  type AboutFields,
} from '../state/repo-about.state'

const { repo, target, reload, org, frozen } = inject(repoKey)!
const { user } = inject(sessionKey)!
const router = useRouter()
const saving = useAction()
const savingAbout = useAction()
const savingForks = useAction()
const removing = useAction()
const isOwner = computed(() => isRepoOwner(target.value.owner, user.value, org.value))

const form = computed<RepoFormValue | undefined>(() => {
  const r = repo.value
  if (!r) return undefined
  return {
    name: r.name,
    visibility: r.visibility,
    lease_hours: r.lease_hours,
    max_locks_per_user: r.max_locks_per_user,
    max_locks_per_user_setting: r.max_locks_per_user_setting,
    max_locks_set_by_policy: r.max_locks_set_by_policy,
  }
})

const about = ref<AboutFields>({ description: '', website: '', topics: '' })
watch(
  () => repo.value?.id,
  () => {
    if (repo.value) about.value = aboutFields(repo.value)
  },
  { immediate: true },
)
const topics = computed(() => parseTopics(about.value.topics))

const save = (s: RepoSettings) =>
  saving.attempt(async () => {
    const updated = await updateRepo(target.value, s)
    void refreshRepos()
    if (updated.name !== target.value.name) await router.replace(repoPath(updated, 'settings'))
    else await reload()
  })

const saveAbout = () => {
  if (topics.value.error) return
  return savingAbout.attempt(async () => {
    const updated = await updateRepo(target.value, aboutRequest(about.value, topics.value.topics))
    about.value = aboutFields(updated)
    void refreshRepos()
    await reload()
  })
}

const setPrivateForks = (on: boolean) =>
  savingForks.attempt(async () => {
    await updateRepo(target.value, { allow_private_forks: on })
    await reload()
  })

const remove = () =>
  removing.attempt(async () => {
    await deleteRepo(target.value)
    void refreshRepos()
    await router.push('/')
  })
</script>

<template>
  <PynViewStack v-if="repo && isOwner">
    <PynRepoForm
      :key="repo.id"
      :owner="repo.owner"
      :repo="form"
      :effective-max-locks="repo.max_locks_per_user"
      :readonly="frozen"
      :busy="saving.busy.value"
      :error="saving.error.value"
      @submit="save"
    />
    <PynSettingsSection
      title="About"
      description="Shown on the repository page and in repository lists."
      plain
      data-about
    >
      <PynViewError v-if="savingAbout.error.value">{{ savingAbout.error.value }}</PynViewError>
      <PynTextArea
        v-model="about.description"
        label="Description"
        optional
        :rows="2"
        :maxlength="DESCRIPTION_MAX"
        :disabled="frozen"
        @submit="saveAbout"
      />
      <PynTextField
        v-model="about.website"
        label="Website"
        type="url"
        optional
        placeholder="https://example.com"
        :disabled="frozen"
      />
      <PynTextField
        v-model="about.topics"
        label="Topics"
        optional
        help="Separate topics with commas: up to 20, each lowercase letters, digits and hyphens."
        :error="topics.error"
        :disabled="frozen"
      />
      <div>
        <PynButton
          label="Save changes"
          :disabled="frozen || savingAbout.busy.value || !!topics.error"
          @click="saveAbout"
        />
      </div>
    </PynSettingsSection>
    <PynSettingsSection v-if="repo?.visibility === 'private'" title="Forks" data-forks>
      <PynViewError v-if="savingForks.error.value">{{ savingForks.error.value }}</PynViewError>
      <PynSettingsToggle
        :model-value="!!repo?.allow_private_forks"
        title="Allow forking"
        help="People who can read this private repository may fork it. A public repository can always be forked."
        :disabled="frozen || savingForks.busy.value"
        @update:model-value="setPrivateForks"
      />
    </PynSettingsSection>
    <PynSettingsSection title="Danger zone" danger plain>
      <PynRepoDelete
        :slug="repo ? repoSlug(repo) : ''"
        :readonly="frozen"
        :busy="removing.busy.value"
        :error="removing.error.value"
        @remove="remove"
      />
    </PynSettingsSection>
  </PynViewStack>
</template>
