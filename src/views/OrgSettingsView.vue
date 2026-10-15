<script setup lang="ts">
import {
  PynPageNotFound,
  PynOrgDelete,
  PynOrgRepoPolicy,
  isOrgOwner,
  type RuleRef,
  PynViewError,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  deleteOrg,
  getRepoPolicy,
  listOrgMembers,
  removeCreationRule,
  setCreationRule,
  setMemberCreation,
} from '../api/orgs'
import { listTeams } from '../api/teams'
import { useAction } from '../state/action.state'
import { orgKey } from '../state/context.state'
import type { MemberCreation, RepoPolicy, RuleScope } from '@avalon-initiative/pyn-common-ui'

const { name, org } = inject(orgKey)!
const router = useRouter()
const removing = useAction()
const policing = useAction()
const policy = ref<RepoPolicy | null>(null)
const teams = ref<string[]>([])
const members = ref<string[]>([])

const load = async () => {
  const [p, t, m] = await Promise.all([
    getRepoPolicy(name.value),
    listTeams(name.value),
    listOrgMembers(name.value),
  ])
  policy.value = p
  teams.value = t.map((x) => x.slug)
  members.value = m.map((x) => x.user)
}

const base = (v: MemberCreation) =>
  policing.attempt(async () => {
    policy.value = await setMemberCreation(name.value, v)
  })

const setRule = (c: { rule: RuleRef; scope: RuleScope }) =>
  policing.attempt(async () => {
    await setCreationRule(name.value, c.rule, c.scope)
    policy.value = await getRepoPolicy(name.value)
  })

const removeRule = (rule: RuleRef) =>
  policing.attempt(async () => {
    await removeCreationRule(name.value, rule)
    policy.value = await getRepoPolicy(name.value)
  })

const remove = () =>
  removing.attempt(async () => {
    await deleteOrg(name.value)
    await router.push('/_/orgs')
  })

const owner = computed(() => isOrgOwner(org.value))

onMounted(() => {
  if (owner.value) void policing.attempt(load)
})
</script>

<template>
  <PynViewStack v-if="owner">
    <PynOrgRepoPolicy
      v-if="policy"
      :policy="policy"
      :teams="teams"
      :members="members"
      :busy="policing.busy.value"
      :error="policing.error.value"
      @set-base="base"
      @set-rule="setRule"
      @remove-rule="removeRule"
    />
    <PynViewError v-else-if="policing.error.value">
      {{ policing.error.value }}
    </PynViewError>
    <PynOrgDelete
      :name="name"
      :busy="removing.busy.value"
      :error="removing.error.value"
      @remove="remove"
    />
  </PynViewStack>
  <PynPageNotFound v-else />
</template>
