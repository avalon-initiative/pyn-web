<script setup lang="ts">
import {
  PynNotices,
  PynPasskeys,
  PynPasswordPrompt,
  PynRecoveryCodes,
  PynTotpEnrolment,
  PynTwoFactor,
  PynTwoFactorNag,
  PynViewError,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import { onMounted } from 'vue'
import { useSecurity } from '../state/security.state'
import { SECURITY_PATH, twoFactorDue } from '../state/two-factor.state'

const s = useSecurity()
onMounted(s.load)
</script>

<template>
  <PynViewStack>
    <PynTwoFactorNag v-if="twoFactorDue" :required="twoFactorDue" :href="SECURITY_PATH" />
    <PynNotices :notices="s.notices.value" :busy="s.busy.value" @dismiss="s.dismiss" />
    <PynRecoveryCodes v-if="s.codes.value" :codes="s.codes.value" @saved="s.acknowledgeCodes" />
    <PynTotpEnrolment
      v-else-if="s.enrolment.value"
      :enrolment="s.enrolment.value"
      :busy="s.busy.value"
      :error="s.error.value"
      @confirm="s.confirm"
      @cancel="s.cancelTotp"
    />
    <PynPasswordPrompt
      v-else-if="s.askPassword.value"
      title="Confirm your password to add a passkey"
      :busy="s.busy.value"
      :error="s.error.value"
      @submit="s.addPasskey"
      @cancel="s.cancelPassword"
    />
    <template v-else-if="s.status.value">
      <PynTwoFactor
        :status="s.status.value"
        :has-password="s.hasPassword.value"
        :busy="s.busy.value"
        :error="s.error.value"
        @add-totp="s.startTotp"
        @remove="s.removeTotp"
        @regenerate-codes="s.regenerate"
      />
      <PynPasskeys
        :passkeys="s.status.value.passkeys ?? []"
        :available="s.passkeysOffered()"
        :busy="s.busy.value"
        @add="s.addPasskey()"
        @rename="(p) => s.rename(p.id, p.name)"
        @remove="s.removeKey"
      />
    </template>
    <PynViewError v-else-if="s.error.value">{{ s.error.value }}</PynViewError>
  </PynViewStack>
</template>
