<script setup lang="ts">
import { PynTokens } from '@avalon-initiative/pyn-common-ui'
import { onMounted, ref } from 'vue'
import { createToken, listTokens, revokeToken } from '../api/tokens'
import { useAction } from '../state/action.state'
import type { TokenForm, TokenInfo } from '@avalon-initiative/pyn-common-ui'

const tokens = ref<TokenInfo[]>([])
const secret = ref('')
const { busy, error, attempt } = useAction()

const load = () =>
  attempt(async () => {
    tokens.value = await listTokens()
  })

const create = (form: TokenForm) =>
  attempt(async () => {
    secret.value = (await createToken(form)).token
    tokens.value = await listTokens()
  })

const revoke = (id: string) =>
  attempt(async () => {
    await revokeToken(id)
    tokens.value = await listTokens()
  })

onMounted(load)
</script>

<template>
  <PynTokens
    :tokens="tokens"
    :secret="secret"
    :busy="busy"
    :error="error"
    @create="create"
    @revoke="revoke"
    @dismiss="secret = ''"
  />
</template>
