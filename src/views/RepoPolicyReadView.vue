<script setup lang="ts">
import {
  PynPolicyView,
  PynViewSummary,
  historyLink,
  repoSettingsPath,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { fetchPolicy } from '../api/repos'
import { useAction } from '../state/action.state'
import { repoKey } from '../state/context.state'
import { POLICY_PATH, EDIT_POLICY } from '../state/policy.state'
import type { ActivePolicy } from '../types/repo.types'

const { target, permissions } = inject(repoKey)!
const policy = ref<ActivePolicy | null>(null)
const { error, attempt } = useAction()
const loading = ref(true)
let seq = 0

async function load() {
  const mine = ++seq
  loading.value = true
  const t = target.value
  await attempt(async () => {
    const next = await fetchPolicy(t)
    if (mine === seq) policy.value = next
  })
  if (mine === seq) loading.value = false
}

const editHref = computed(() =>
  permissions.value.includes(EDIT_POLICY) ? repoSettingsPath(target.value, 'policy') : undefined,
)

onMounted(load)
watch(target, () => {
  policy.value = null
  void load()
})
</script>

<template>
  <PynViewSummary v-if="policy?.warning" data-policy-warning>{{ policy.warning }}</PynViewSummary>
  <PynViewSummary v-if="policy?.commit" data-policy-commit>
    Set by commit <code>{{ policy.commit.slice(0, 7) }}</code>.
    <a :href="historyLink(target, POLICY_PATH)">History of the policy file</a>
  </PynViewSummary>
  <PynPolicyView
    :mode="policy?.default_mode ?? 'shared'"
    :rules="policy?.rules ?? []"
    :file="POLICY_PATH"
    :edit-href="editHref"
    :loading="loading"
    :error="error || undefined"
  />
</template>
