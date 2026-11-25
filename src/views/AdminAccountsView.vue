<script setup lang="ts">
import {
  PynAccounts,
  PynAddAccount,
  applyUpdate,
  PynViewHeader,
  PynViewNotice,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import { inject, onMounted, ref } from 'vue'
import {
  addAccount,
  approveAccount,
  deleteAccount,
  disableAccount,
  enableAccount,
  fetchAdminSettings,
  grantAdmin,
  listAccounts,
  resendConfirmation,
  resetTwoFactor,
  revokeAdmin,
} from '../api/admin'
import { markPending, retentionNote } from '../state/admin-settings.state'
import { useAction } from '../state/action.state'
import { sessionKey } from '../state/context.state'
import type { AdminSettings } from '../types/admin.types'
import type {
  AccountInfo,
  AdminAccountStatus,
  DeleteAccountRequest,
  DisableRequest,
} from '@avalon-initiative/pyn-common-ui'

const { user } = inject(sessionKey)!
const status = ref<AdminAccountStatus | ''>('')
const accounts = ref<AccountInfo[]>([])
const people = useAction()

const loadAccounts = () =>
  people.attempt(async () => {
    accounts.value = markPending(await listAccounts(status.value))
  })

const filter = (s: AdminAccountStatus | '') => {
  status.value = s
  return loadAccounts()
}

const change = (action: () => Promise<AccountInfo>) =>
  people.attempt(async () => {
    accounts.value = applyUpdate(accounts.value, markPending([await action()])[0], status.value)
  })

const approve = (name: string) => change(() => approveAccount(name))
const enable = (name: string) => change(() => enableAccount(name))
const disable = (r: DisableRequest) => change(() => disableAccount(r.user, r.reason))

const remove = (r: DeleteAccountRequest) =>
  people.attempt(async () => {
    await deleteAccount(r)
    accounts.value = markPending(await listAccounts(status.value))
  })

const reset = (name: string) => {
  if (!window.confirm(`Remove every second factor and recovery code of ${name}?`)) return
  return people.attempt(() => resetTwoFactor(name))
}

const sent = ref('')
const resending = ref('')
const adding = useAction(false)
const addOpen = ref(false)

const resend = async (name: string) => {
  sent.value = ''
  resending.value = name
  const ok = await people.attempt(() => resendConfirmation(name))
  resending.value = ''
  if (ok) sent.value = `A confirmation link was sent to ${name}.`
  else accounts.value = markPending(await listAccounts(status.value).catch(() => accounts.value))
}

const add = async (form: { username: string; password: string }) => {
  sent.value = ''
  const ok = await adding.attempt(async () => {
    await addAccount(form.username, form.password)
  })
  if (!ok) return
  addOpen.value = false
  sent.value = `Added ${form.username}. They must choose their own password when they first sign in.`
  await loadAccounts()
}

const note = ref('')
const administrators = ref<AdminSettings['administrators']>({ active: 0, single: false })

const loadSettings = () =>
  fetchAdminSettings()
    .then((s) => {
      note.value = retentionNote(s)
      administrators.value = s.administrators
    })
    .catch(() => undefined)

const changeAdmin = (action: () => Promise<AccountInfo>) =>
  people.attempt(async () => {
    await action()
    accounts.value = markPending(await listAccounts(status.value))
    await loadSettings()
  })

const grant = (name: string) => changeAdmin(() => grantAdmin(name))
const revoke = (name: string) => changeAdmin(() => revokeAdmin(name))

onMounted(() => {
  void loadAccounts()
  void loadSettings()
})
</script>

<template>
  <PynViewStack>
    <PynViewHeader title="Accounts" />
    <PynViewNotice v-if="administrators.single" title="Only one administrator">
      This server has a single administrator, so one lost credential means recovery on the host.
      Grant the administrator role to a second account in the list below.
    </PynViewNotice>
    <p v-if="note">{{ note }}</p>
    <PynViewNotice v-if="sent" tone="info" title="Done" dismissible @dismiss="sent = ''">{{
      sent
    }}</PynViewNotice>
    <PynAddAccount
      v-model:adding="addOpen"
      :busy="adding.busy.value"
      :error="adding.error.value"
      @add="add"
    />
    <PynAccounts
      :accounts="accounts"
      :status="status"
      :self="user"
      :busy="people.busy.value"
      :error="people.error.value"
      :resending-user="resending"
      :can-revoke-admin="!administrators.single"
      @status="filter"
      @approve="approve"
      @enable="enable"
      @disable="disable"
      @delete="remove"
      @grant-admin="grant"
      @revoke-admin="revoke"
      @reset="reset"
      @resend-confirmation="resend"
    />
  </PynViewStack>
</template>
