<script setup lang="ts">
import {
  PynAccounts,
  PynAudit,
  PynPageNotFound,
  applyUpdate,
  PynViewGroup,
  PynViewHeader,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import { inject, onMounted, ref } from 'vue'
import {
  approveAccount,
  disableAccount,
  enableAccount,
  listAccounts,
  listServerAudit,
} from '../api/admin'
import { useAction } from '../state/action.state'
import { sessionKey } from '../state/context.state'
import type {
  AccountInfo,
  AdminAccountStatus,
  DisableRequest,
} from '@avalon-initiative/pyn-common-ui'
import type { AuditEntry } from '@avalon-initiative/pyn-common-ui'

const { user, admin } = inject(sessionKey)!
const status = ref<AdminAccountStatus | ''>('')
const accounts = ref<AccountInfo[]>([])
const entries = ref<AuditEntry[]>([])
const next = ref<number | null>(null)
const people = useAction()
const log = useAction()

const loadAccounts = () =>
  people.attempt(async () => {
    accounts.value = await listAccounts(status.value)
  })

const loadAudit = (more = false) =>
  log.attempt(async () => {
    const page = await listServerAudit(more ? (next.value ?? undefined) : undefined)
    entries.value = more ? [...entries.value, ...page.entries] : page.entries
    next.value = page.next_before
  })

const filter = (s: AdminAccountStatus | '') => {
  status.value = s
  return loadAccounts()
}

const change = (action: () => Promise<AccountInfo>) =>
  people.attempt(async () => {
    accounts.value = applyUpdate(accounts.value, await action(), status.value)
    await loadAudit()
  })

const approve = (name: string) => change(() => approveAccount(name))
const enable = (name: string) => change(() => enableAccount(name))
const disable = (r: DisableRequest) => change(() => disableAccount(r.user, r.reason))

onMounted(() => {
  if (!admin.value) return
  loadAccounts()
  loadAudit()
})
</script>

<template>
  <PynPageNotFound v-if="!admin" />
  <PynViewStack v-else>
    <PynViewHeader title="Accounts" />
    <PynAccounts
      :accounts="accounts"
      :status="status"
      :self="user"
      :busy="people.busy.value"
      :error="people.error.value"
      @status="filter"
      @approve="approve"
      @enable="enable"
      @disable="disable"
    />
    <PynViewGroup title="Server audit log">
      <PynAudit
        plain
        :entries="entries"
        :has-more="next !== null"
        :busy="log.busy.value"
        :error="log.error.value"
        @more="loadAudit(true)"
      />
    </PynViewGroup>
  </PynViewStack>
</template>
