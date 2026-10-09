<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'
import { listOrgAudit } from '../api/orgs'
import PynAudit from '../components/PynAudit.vue'
import PynPageNotFound from '../components/PynPageNotFound.vue'
import { useAction } from '../state/action.state'
import { orgKey } from '../state/context.state'
import { isOrgOwner } from '../state/org.state'
import type { AuditEntry } from '../types/repo.types'

const { name, org } = inject(orgKey)!
const entries = ref<AuditEntry[]>([])
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
    :entries="entries"
    :has-more="next !== null"
    :busy="busy"
    :error="error"
    @more="load(true)"
  />
  <PynPageNotFound v-else />
</template>
