<script setup lang="ts">
import { PynEmailAddresses } from '@avalon-initiative/pyn-common-ui'
import type { AccountEmail } from '@avalon-initiative/pyn-common-ui'
import { onMounted, ref } from 'vue'
import { addEmail, listEmails, removeEmail, resendEmail, setPrimaryEmail } from '../api/emails'
import { useAction } from '../state/action.state'

const emails = ref<AccountEmail[]>([])
const sent = ref('')
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

onMounted(load)
</script>

<template>
  <PynEmailAddresses
    :emails="emails"
    :busy="busy"
    :error="error"
    :sent="sent"
    @add="(a: string) => change(() => addEmail(a), a)"
    @resend="(a: string) => change(() => resendEmail(a), a)"
    @primary="(a: string) => change(() => setPrimaryEmail(a))"
    @remove="(a: string) => change(() => removeEmail(a))"
  />
</template>
