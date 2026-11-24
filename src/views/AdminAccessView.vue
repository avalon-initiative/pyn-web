<script setup lang="ts">
import {
  PynAccessMode,
  PynButton,
  PynEmailStatus,
  PynSettingsRow,
  PynSettingsSection,
  PynViewError,
  PynViewHeader,
  PynViewNotice,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import { computed, onMounted, ref } from 'vue'
import { fetchAccessMode, fetchAdminSettings, sendTestEmail, setAccessMode } from '../api/admin'
import { fetchRegistration } from '../api/auth'
import { useAction } from '../state/action.state'
import { accessChecklist } from '../state/access.state'
import { emailFacts } from '../state/admin-settings.state'
import type { AccessMode } from '@avalon-initiative/pyn-common-ui'
import type { RegistrationInfo } from '../types/auth.types'
import type { AdminSettings, ServerSetup } from '../types/admin.types'

const setup = ref<ServerSetup | null>(null)
const registration = ref<RegistrationInfo | null>(null)
const emailSettings = ref<AdminSettings['email'] | null>(null)
const load = useAction()
const save = useAction()
const test = useAction()
const testResult = ref<{ delivered: boolean; error: string | null } | null>(null)

const checklist = computed(() =>
  setup.value ? accessChecklist(setup.value, registration.value) : [],
)

const facts = computed(() =>
  emailSettings.value ? emailFacts(emailSettings.value, new Date()) : [],
)

const readEmail = async () => {
  emailSettings.value = (await fetchAdminSettings().catch(() => null))?.email ?? null
}

onMounted(() =>
  load.attempt(async () => {
    setup.value = await fetchAccessMode()
    registration.value = await fetchRegistration().catch(() => null)
    await readEmail()
  }),
)

const sendTest = () => {
  testResult.value = null
  return test.attempt(async () => {
    testResult.value = await sendTestEmail()
    await readEmail()
  })
}

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
    <template v-if="emailSettings">
      <PynEmailStatus :mailer="emailSettings.mailer" :verification="emailSettings.verification" />
      <PynSettingsSection title="Email delivery">
        <PynSettingsRow v-for="f in facts" :key="f.title" :title="f.title">
          {{ f.value }}
        </PynSettingsRow>
        <PynSettingsRow title="Test email" help="Sends a message to your primary verified address.">
          <PynButton
            label="Send a test email"
            variant="secondary"
            :disabled="test.busy.value"
            @click="sendTest"
          />
        </PynSettingsRow>
      </PynSettingsSection>
      <PynViewError v-if="test.error.value">{{ test.error.value }}</PynViewError>
      <PynViewNotice v-else-if="testResult?.delivered" tone="success">
        The test email was accepted for delivery.
      </PynViewNotice>
      <PynViewNotice v-else-if="testResult" tone="danger" title="The test email was not sent">
        {{ testResult.error }}
      </PynViewNotice>
    </template>
  </PynViewStack>
</template>
