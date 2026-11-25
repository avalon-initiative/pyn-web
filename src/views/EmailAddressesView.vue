<script setup lang="ts">
import { PynEmailAddresses } from '@avalon-initiative/pyn-common-ui'
import type { AccountEmail } from '@avalon-initiative/pyn-common-ui'
import { onMounted, ref } from 'vue'
import { addEmail, listEmails, removeEmail, resendEmail, setPrimaryEmail } from '../api/emails'
import { useAction } from '../state/action.state'

const emails = ref<AccountEmail[]>([])
const sent = ref('')
const adding = ref(false)
const { busy, error, attempt } = useAction()

const load = () =>
  attempt(async () => {
    emails.value = await listEmails()
  })

const change = (action: () => Promise<unknown>, linked = '') =>
  attempt(async () => {
    sent.value = ''
    await action()
    emails.value = await listEmails()
    sent.value = linked
  })

const add = (a: string) =>
  change(async () => {
    await addEmail(a)
    adding.value = false
  }, a)

onMounted(load)
</script>

<template>
  <PynEmailAddresses
    v-model:adding="adding"
    :emails="emails"
    :busy="busy"
    :error="error"
    :sent="sent"
    @add="add"
    @resend="(a: string) => change(() => resendEmail(a), a)"
    @primary="(a: string) => change(() => setPrimaryEmail(a))"
    @remove="(a: string) => change(() => removeEmail(a))"
  />
</template>
