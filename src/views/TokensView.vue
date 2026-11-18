<script setup lang="ts">
import { ownerChoices, PynTokens } from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { listMyOrgs } from '../api/orgs'
import { listRepos } from '../api/repos'
import { createToken, listTokens, revokeToken } from '../api/tokens'
import { useAction } from '../state/action.state'
import { sessionKey } from '../state/context.state'
import type { OrgInfo, TokenForm, TokenInfo } from '@avalon-initiative/pyn-common-ui'

const user = inject(sessionKey)!.user
const tokens = ref<TokenInfo[]>([])
const orgs = ref<OrgInfo[]>([])
const repos = ref<string[]>([])
const secret = ref('')
const { busy, error, attempt } = useAction()

const owners = computed(() =>
  ownerChoices(user.value, orgs.value).map((name) => ({
    name,
    kind: name === user.value ? ('account' as const) : ('org' as const),
  })),
)

const loadRepos = (owner: string) =>
  attempt(async () => {
    repos.value = (await listRepos(owner)).map((r) => `${r.owner}/${r.name}`)
  })

const load = () =>
  attempt(async () => {
    const [list, mine] = await Promise.all([listTokens(), listMyOrgs().catch(() => [])])
    tokens.value = list
    orgs.value = mine
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

onMounted(async () => {
  await load()
  await loadRepos(user.value)
})
</script>

<template>
  <PynTokens
    :tokens="tokens"
    :owners="owners"
    :repos="repos"
    :secret="secret"
    :busy="busy"
    :error="error"
    @create="create"
    @revoke="revoke"
    @dismiss="secret = ''"
    @owner-change="loadRepos"
  />
</template>
