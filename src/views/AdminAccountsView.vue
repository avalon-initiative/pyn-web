<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'
import {
  approveAccount,
  disableAccount,
  enableAccount,
  listAccounts,
  listServerAudit,
} from '../api/admin'
import PynAccounts from '../components/PynAccounts.vue'
import PynAudit from '../components/PynAudit.vue'
import PynPageNotFound from '../components/PynPageNotFound.vue'
import { useAction } from '../state/action.state'
import { applyUpdate } from '../state/admin.state'
import { sessionKey } from '../state/context.state'
import styles from '../styles/View.module.scss'
import type { AccountInfo, AdminAccountStatus, DisableRequest } from '../types/admin.types'
import type { AuditEntry } from '../types/repo.types'

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
  <div v-else :class="styles.stack">
    <header :class="styles.header">
      <h1 :class="styles.title">Accounts</h1>
    </header>
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
    <section>
      <h2 :class="styles.groupTitle">Server audit log</h2>
      <PynAudit
        plain
        :entries="entries"
        :has-more="next !== null"
        :busy="log.busy.value"
        :error="log.error.value"
        @more="loadAudit(true)"
      />
    </section>
  </div>
</template>
