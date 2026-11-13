<script setup lang="ts">
import { PynAudit, PynViewHeader, PynViewStack } from '@avalon-initiative/pyn-common-ui'
import { onMounted, ref } from 'vue'
import { listServerAudit } from '../api/admin'
import { useAction } from '../state/action.state'
import type { AuditEntry } from '@avalon-initiative/pyn-common-ui'

const entries = ref<AuditEntry[]>([])
const next = ref<number | null>(null)
const log = useAction()

const load = (more = false) =>
  log.attempt(async () => {
    const page = await listServerAudit(more ? (next.value ?? undefined) : undefined)
    entries.value = more ? [...entries.value, ...page.entries] : page.entries
    next.value = page.next_before
  })

onMounted(() => load())
</script>

<template>
  <PynViewStack>
    <PynViewHeader title="Audit log" />
    <PynAudit
      plain
      :entries="entries"
      :has-more="next !== null"
      :busy="log.busy.value"
      :error="log.error.value"
      @more="load(true)"
    />
  </PynViewStack>
</template>
