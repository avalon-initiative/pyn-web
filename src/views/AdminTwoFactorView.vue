<script setup lang="ts">
import {
  PynTwoFactorRequirement,
  PynViewHeader,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import { onMounted, ref } from 'vue'
import { getServerTwoFactor, setServerTwoFactor } from '../api/admin'
import { useAction } from '../state/action.state'
import type { TwoFactorRequirementChange, TwoFactorSetting } from '@avalon-initiative/pyn-common-ui'

const setting = ref<TwoFactorSetting | null>(null)
const load = useAction()
const save = useAction()

onMounted(() =>
  load.attempt(async () => {
    setting.value = await getServerTwoFactor()
  }),
)

const change = (c: TwoFactorRequirementChange) =>
  save.attempt(async () => {
    setting.value = await setServerTwoFactor(c.required, c.grace_days)
  })
</script>

<template>
  <PynViewStack>
    <PynViewHeader title="Two-factor authentication" />
    <p v-if="load.error.value" role="alert">{{ load.error.value }}</p>
    <PynTwoFactorRequirement
      v-else-if="setting"
      :setting="setting"
      :busy="save.busy.value"
      :error="save.error.value"
      @change="change"
    />
  </PynViewStack>
</template>
