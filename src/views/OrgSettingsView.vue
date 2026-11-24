<script setup lang="ts">
import {
  PynOrgDelete,
  PynOrgRepoPolicy,
  PynOrgSettings,
  PynSettingsSection,
  PynTwoFactorRequirement,
  isOrgOwner,
  type RuleRef,
  PynViewError,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import NotFoundView from './NotFoundView.vue'
import { computed, inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  deleteOrg,
  getOrgSettings,
  getOrgTwoFactor,
  getRepoPolicy,
  listOrgMembers,
  removeCreationRule,
  setCreationRule,
  setOrgSettings,
  setOrgTwoFactor,
  setMemberCreation,
} from '../api/orgs'
import { listTeams } from '../api/teams'
import { useAction } from '../state/action.state'
import { orgKey } from '../state/context.state'
import { refreshOrgs } from '../state/session-data.state'
import type {
  MemberCreation,
  OrgSettings,
  RepoPolicy,
  RuleScope,
  TwoFactorRequirementChange,
  TwoFactorSetting,
} from '@avalon-initiative/pyn-common-ui'

const { name, org, frozen } = inject(orgKey)!
const router = useRouter()
const removing = useAction()
const policing = useAction()
const settings = ref<OrgSettings | null>(null)
const requirement = ref<TwoFactorSetting | null>(null)
const configuring = useAction()
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

const loadSettings = () =>
  configuring.attempt(async () => {
    ;[settings.value, requirement.value] = await Promise.all([
      getOrgSettings(name.value),
      getOrgTwoFactor(name.value),
    ])
  })

const saveSettings = (s: OrgSettings) =>
  configuring.attempt(async () => {
    settings.value = await setOrgSettings(name.value, s)
  })

const changeRequirement = (c: TwoFactorRequirementChange) =>
  configuring.attempt(async () => {
    requirement.value = await setOrgTwoFactor(name.value, c.required, c.grace_days)
  })

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
    void refreshOrgs()
    await router.push('/_/orgs')
  })

const owner = computed(() => isOrgOwner(org.value))

onMounted(() => {
  if (!owner.value) return
  void policing.attempt(load)
  void loadSettings()
})
</script>

<template>
  <PynViewStack v-if="owner">
    <PynOrgRepoPolicy
      v-if="policy"
      :policy="policy"
      :teams="teams"
      :members="members"
      :readonly="frozen"
      :busy="policing.busy.value"
      :error="policing.error.value"
      @set-base="base"
      @set-rule="setRule"
      @remove-rule="removeRule"
    />
    <PynViewError v-else-if="policing.error.value">
      {{ policing.error.value }}
    </PynViewError>
    <PynOrgSettings
      v-if="settings"
      :settings="settings"
      :readonly="frozen"
      :busy="configuring.busy.value"
      :error="configuring.error.value"
      @save="saveSettings"
    />
    <PynTwoFactorRequirement
      v-if="requirement"
      :setting="requirement"
      :readonly="frozen"
      :busy="configuring.busy.value"
      :error="configuring.error.value"
      @change="changeRequirement"
    />
    <PynSettingsSection title="Danger zone" danger plain>
      <PynOrgDelete
        :name="name"
        :readonly="frozen"
        :busy="removing.busy.value"
        :error="removing.error.value"
        @remove="remove"
      />
    </PynSettingsSection>
  </PynViewStack>
  <NotFoundView v-else />
</template>
