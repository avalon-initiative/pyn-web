<script setup lang="ts">
import {
  PynButton,
  PynRepoDelete,
  PynRepoForm,
  PynRepoIconUpload,
  PynRepoVisibility,
  PynSettingsSection,
  PynSettingsToggle,
  PynTextArea,
  PynTextField,
  PynTopicsInput,
  PynViewError,
  type RepoFormValue,
  type RepoSettings,
  type Visibility,
  repoPath,
  repoSlug,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { deleteRepo, removeRepoIcon, updateRepo, uploadRepoIcon } from '../api/repos'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { refreshRepos } from '../state/session-data.state'
import { isRepoOwner } from '../state/repo-access.state'
import {
  DESCRIPTION_MAX,
  aboutChanged,
  aboutFields,
  aboutRequest,
  type AboutFields,
} from '../state/repo-about.state'
import { describeIconError } from '../state/repo-icon.state'
import type { RepoDetails } from '../types/repo.types'

const { repo, target, reload, org, frozen, ownerAvatar } = inject(repoKey)!
const { user } = inject(sessionKey)!
const router = useRouter()
const saving = useAction()
const savingAbout = useAction()
const savingForks = useAction()
const savingVisibility = useAction()
const savingIcon = useAction(true, describeIconError)
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

const about = ref<AboutFields>({ description: '', website: '', topics: [] })
watch(
  () => repo.value?.id,
  () => {
    if (repo.value) about.value = aboutFields(repo.value)
  },
  { immediate: true },
)
const topicsInput = ref<InstanceType<typeof PynTopicsInput>>()
const changed = computed(() => !!repo.value && aboutChanged(about.value, repo.value))
// The server's refusal of a topic belongs under the topics field; anything else above the section.
const topicsError = computed(() =>
  /topic/i.test(savingAbout.error.value) ? savingAbout.error.value : '',
)

const save = (s: RepoSettings) =>
  saving.attempt(async () => {
    const updated = await updateRepo(target.value, s)
    void refreshRepos()
    if (updated.name !== target.value.name) await router.replace(repoPath(updated, 'settings'))
    else await reload()
  })

const saveAbout = () => {
  if (topicsInput.value && !topicsInput.value.commit()) return
  return savingAbout.attempt(async () => {
    const updated = await updateRepo(target.value, aboutRequest(about.value))
    about.value = aboutFields(updated)
    void refreshRepos()
    await reload()
  })
}

const resetAbout = () => {
  if (repo.value) about.value = aboutFields(repo.value)
  savingAbout.error.value = ''
}

const setPrivateForks = (on: boolean) =>
  savingForks.attempt(async () => {
    await updateRepo(target.value, { allow_private_forks: on })
    await reload()
  })

const setVisibility = (visibility: Visibility) =>
  savingVisibility.attempt(async () => {
    await updateRepo(target.value, { visibility })
    await reload()
    void refreshRepos()
  })

const changeIcon = (change: () => Promise<RepoDetails>) =>
  savingIcon.attempt(async () => {
    repo.value = await change()
    void refreshRepos()
  })
const uploadIcon = (file: File) => changeIcon(() => uploadRepoIcon(target.value, file))
const clearIcon = () => changeIcon(() => removeRepoIcon(target.value))

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
    <PynRepoIconUpload
      :owner="repo.owner"
      :icon-url="repo.icon_url"
      :owner-avatar-url="ownerAvatar"
      :readonly="frozen"
      :busy="savingIcon.busy.value"
      :error="savingIcon.error.value"
      @upload="uploadIcon"
      @clear="clearIcon"
    />
    <PynSettingsSection
      title="About"
      description="Shown on the repository page and in repository lists."
      plain
      form-width
      data-about
    >
      <PynViewError v-if="savingAbout.error.value && !topicsError">{{
        savingAbout.error.value
      }}</PynViewError>
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
      <PynTopicsInput
        ref="topicsInput"
        v-model="about.topics"
        optional
        :error="topicsError"
        :disabled="frozen"
      />
      <template #footer>
        <PynButton
          label="Cancel"
          variant="secondary"
          :disabled="frozen || savingAbout.busy.value || !changed"
          @click="resetAbout"
        />
        <PynButton
          label="Save changes"
          :disabled="frozen || savingAbout.busy.value"
          @click="saveAbout"
        />
      </template>
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
      <PynRepoVisibility
        v-if="repo"
        :slug="repoSlug(repo)"
        :visibility="repo.visibility"
        :readonly="frozen"
        :busy="savingVisibility.busy.value"
        :error="savingVisibility.error.value"
        @change="setVisibility"
      />
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
