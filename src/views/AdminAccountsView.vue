<script setup lang="ts">
import {
  PynAccounts,
  applyUpdate,
  PynViewHeader,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import { inject, onMounted, ref } from 'vue'
import { approveAccount, disableAccount, enableAccount, listAccounts } from '../api/admin'
import { useAction } from '../state/action.state'
import { sessionKey } from '../state/context.state'
import type {
  AccountInfo,
  AdminAccountStatus,
  DisableRequest,
} from '@avalon-initiative/pyn-common-ui'

const { user } = inject(sessionKey)!
const status = ref<AdminAccountStatus | ''>('')
const accounts = ref<AccountInfo[]>([])
const people = useAction()

const loadAccounts = () =>
  people.attempt(async () => {
    accounts.value = await listAccounts(status.value)
  })

const filter = (s: AdminAccountStatus | '') => {
  status.value = s
  return loadAccounts()
}

const change = (action: () => Promise<AccountInfo>) =>
  people.attempt(async () => {
    accounts.value = applyUpdate(accounts.value, await action(), status.value)
  })

const approve = (name: string) => change(() => approveAccount(name))
const enable = (name: string) => change(() => enableAccount(name))
const disable = (r: DisableRequest) => change(() => disableAccount(r.user, r.reason))

onMounted(loadAccounts)
</script>

<template>
  <PynViewStack>
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
  </PynViewStack>
</template>
