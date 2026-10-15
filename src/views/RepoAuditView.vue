<script setup lang="ts">
import { type AuditFilter, PynAudit } from '@avalon-initiative/pyn-common-ui'
import { inject, onMounted, ref } from 'vue'
import { listAudit } from '../api/repos'
import { useAction } from '../state/action.state'
import { repoKey } from '../state/context.state'
import type { AuditEntry } from '@avalon-initiative/pyn-common-ui'

const { target } = inject(repoKey)!
const filter = ref<AuditFilter>({ path: '', actor: '', action: '' })
const entries = ref<AuditEntry[]>([])
const next = ref<number | null>(null)
const { busy, error, attempt } = useAction()

const load = (more = false) =>
  attempt(async () => {
    const page = await listAudit(
      target.value,
      filter.value,
      more ? (next.value ?? undefined) : undefined,
    )
    entries.value = more ? [...entries.value, ...page.entries] : page.entries
    next.value = page.next_before
  })

const apply = (f: AuditFilter) => {
  filter.value = f
  return load()
}

onMounted(() => load())
</script>

<template>
  <PynAudit
    :entries="entries"
    :filter="filter"
    :has-more="next !== null"
    :busy="busy"
    :error="error"
    @filter="apply"
    @more="load(true)"
  />
</template>
