<script setup lang="ts">
import {
  PynOrgDelete,
  PynOrgSettings,
  PynSettingsSection,
  PynTwoFactorRequirement,
  isOrgOwner,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import NotFoundView from './NotFoundView.vue'
import { computed, inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  deleteOrg,
  getOrgSettings,
  getOrgTwoFactor,
  setOrgSettings,
  setOrgTwoFactor,
} from '../api/orgs'
import { useAction } from '../state/action.state'
import { orgKey } from '../state/context.state'
import { refreshOrgs } from '../state/session-data.state'
import type {
  OrgSettings,
  TwoFactorRequirementChange,
  TwoFactorSetting,
} from '@avalon-initiative/pyn-common-ui'

const { name, org, frozen } = inject(orgKey)!
const router = useRouter()
const removing = useAction()
const settings = ref<OrgSettings | null>(null)
const requirement = ref<TwoFactorSetting | null>(null)
const configuring = useAction()

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

const remove = () =>
  removing.attempt(async () => {
    await deleteOrg(name.value)
    void refreshOrgs()
    await router.push('/_/orgs')
  })

const owner = computed(() => isOrgOwner(org.value))

onMounted(() => {
  if (!owner.value) return
  void loadSettings()
})
</script>

<template>
  <PynViewStack v-if="owner">
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
      title="Two-factor authentication"
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
