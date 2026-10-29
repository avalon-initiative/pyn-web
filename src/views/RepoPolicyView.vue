<script setup lang="ts">
import {
  PynPolicyConflictNotice,
  PynPolicyEditor,
  PynPolicyPreview,
  PynViewSummary,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  checkin,
  checkout,
  fetchContent,
  fetchFileEntry,
  listLocks,
  previewPolicy,
  putObject,
} from '../api/repos'
import { useAction } from '../state/action.state'
import { repoKey } from '../state/context.state'
import { POLICY_PATH, usePolicyEditor } from '../state/policy.state'

const POLICY_LIMIT = 1024 * 1024
const SAVE_MESSAGE = 'Update repository policy'

const { target, permissions, frozen } = inject(repoKey)!
const holder = ref('')
const locking = useAction()
const router = useRouter()

const ed = usePolicyEditor(
  {
    entry: () => fetchFileEntry(target.value, POLICY_PATH),
    read: async (revision) => {
      const { bytes } = await fetchContent(target.value, POLICY_PATH, POLICY_LIMIT, revision)
      return new TextDecoder().decode(bytes)
    },
    preview: (text) => previewPolicy(target.value, text),
    upload: (text) => putObject(target.value, text),
    checkin: (body) => checkin(target.value, body),
  },
  () => permissions.value,
)

const kind = computed(() => {
  const k = ed.conflict.value?.kind
  return k === undefined || k === 'forbidden' ? 'error' : k
})
const problems = computed(() =>
  ed.conflict.value?.kind === 'invalid_rules' ? [{ message: ed.conflict.value.message }] : [],
)

async function save() {
  holder.value = ''
  if (await ed.save(SAVE_MESSAGE)) return
  if (ed.conflict.value?.kind !== 'lock_held') return
  const lock = await listLocks(target.value)
    .then((all) => all.find((l) => l.path === POLICY_PATH))
    .catch(() => undefined)
  holder.value = lock?.owner ?? ''
}

function openPath(path: string) {
  const { owner, name } = target.value
  window.open(router.resolve({ name: 'blob', params: { owner, name, path } }).href, '_blank')
}

const takeLock = () =>
  locking.attempt(async () => {
    await checkout(target.value, POLICY_PATH, ed.revision.value)
    await save()
  })

function dismiss() {
  ed.conflict.value = null
  locking.error.value = ''
}

onMounted(() => {
  if (ed.canEdit.value) ed.load()
})
</script>

<template>
  <PynViewSummary v-if="ed.loadError.value">{{ ed.loadError.value }}</PynViewSummary>
  <PynPolicyPreview
    v-else-if="ed.canEdit.value && ed.previewing.value"
    :preview="ed.preview.value"
    :loading="ed.previewLoading.value"
    :error="ed.previewError.value"
    :busy="ed.saving.value"
    @select-path="openPath"
    @confirm="save"
    @back="ed.closePreview"
    @retry="ed.requestPreview"
  />
  <PynPolicyEditor
    v-else-if="ed.canEdit.value"
    v-model:text="ed.text.value"
    :head-revision="ed.revision.value ?? undefined"
    :dirty="ed.dirty.value"
    :saving="ed.saving.value"
    :disabled="ed.loading.value"
    :readonly="frozen"
    @save="ed.requestPreview"
    @revert="ed.discard"
  >
    <template #notice>
      <PynPolicyConflictNotice
        v-if="ed.conflict.value || locking.error.value"
        :kind="ed.conflict.value ? kind : 'error'"
        :holder="holder || undefined"
        :problems="problems"
        :message="ed.conflict.value?.message ?? locking.error.value"
        :busy="ed.saving.value || locking.busy.value"
        @take-lock="takeLock"
        @retry="save"
        @reload="ed.load(true)"
        @discard="ed.discard"
        @dismiss="dismiss"
      />
    </template>
  </PynPolicyEditor>
</template>
