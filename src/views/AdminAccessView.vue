<script setup lang="ts">
import {
  PynAccessMode,
  PynEmailStatus,
  PynViewHeader,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import { computed, onMounted, ref } from 'vue'
import { fetchAccessMode, fetchAdminSettings, setAccessMode } from '../api/admin'
import { fetchRegistration } from '../api/auth'
import { useAction } from '../state/action.state'
import { accessChecklist } from '../state/access.state'
import type { AccessMode } from '@avalon-initiative/pyn-common-ui'
import type { RegistrationInfo } from '../types/auth.types'
import type { AdminSettings, ServerSetup } from '../types/admin.types'

const setup = ref<ServerSetup | null>(null)
const registration = ref<RegistrationInfo | null>(null)
const emailSettings = ref<AdminSettings['email'] | null>(null)
const load = useAction()
const save = useAction()

const checklist = computed(() =>
  setup.value ? accessChecklist(setup.value, registration.value) : [],
)

onMounted(() =>
  load.attempt(async () => {
    setup.value = await fetchAccessMode()
    registration.value = await fetchRegistration().catch(() => null)
    emailSettings.value = (await fetchAdminSettings().catch(() => null))?.email ?? null
  }),
)

const change = (mode: AccessMode) =>
  save.attempt(async () => {
    const now = await setAccessMode(mode)
    if (setup.value) setup.value = { ...setup.value, access_mode: now.access_mode }
  })
</script>

<template>
  <PynViewStack>
    <PynViewHeader title="Server access" />
    <p v-if="load.error.value" role="alert">{{ load.error.value }}</p>
    <PynAccessMode
      v-else-if="setup"
      :mode="setup.access_mode"
      :checklist="checklist"
      :busy="save.busy.value"
      :error="save.error.value"
      @change="change"
    />
    <PynEmailStatus
      v-if="emailSettings"
      :mailer="emailSettings.mailer"
      :verification="emailSettings.verification"
    />
  </PynViewStack>
</template>
