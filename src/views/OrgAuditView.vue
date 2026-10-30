<script setup lang="ts">
import {
  PynAudit,
  PynPageNotFound,
  isOrgOwner,
  orgAuditLabel,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { listOrgAudit } from '../api/orgs'
import { useAction } from '../state/action.state'
import { orgKey } from '../state/context.state'
import type { AuditEntry } from '@avalon-initiative/pyn-common-ui'

const { name, org } = inject(orgKey)!
const entries = ref<AuditEntry[]>([])
const labelled = computed(() =>
  entries.value.map((e) => ({ ...e, action: orgAuditLabel(e.action) })),
)
const next = ref<number | null>(null)
const { busy, error, attempt } = useAction()

const load = (more = false) =>
  attempt(async () => {
    const page = await listOrgAudit(name.value, more ? (next.value ?? undefined) : undefined)
    entries.value = more ? [...entries.value, ...page.entries] : page.entries
    next.value = page.next_before
  })

onMounted(() => {
  if (isOrgOwner(org.value)) load()
})
</script>

<template>
  <PynAudit
    v-if="isOrgOwner(org)"
    plain
    :entries="labelled"
    :has-more="next !== null"
    :busy="busy"
    :error="error"
    @more="load(true)"
  />
  <PynPageNotFound v-else />
</template>
