<script setup lang="ts">
import {
  PynButton,
  PynPasskeys,
  PynRecoveryCodes,
  PynTotpEnrolment,
  PynViewGroup,
  PynViewNotice,
  PynViewStack,
} from '@avalon-initiative/pyn-common-ui'
import { onMounted } from 'vue'
import { useSecurity } from '../state/security.state'
import { nagText, noticeText, twoFactorDue } from '../state/two-factor.state'

const s = useSecurity()
onMounted(s.load)
</script>

<template>
  <PynViewStack>
    <PynViewNotice v-if="twoFactorDue" tone="warning" title="Two-factor authentication required">
      {{ nagText(twoFactorDue) }}
    </PynViewNotice>
    <PynViewNotice v-for="n in s.notices.value" :key="n.id" tone="warning">
      {{ noticeText(n.kind, n.detail) }}
      <PynButton label="Dismiss" variant="secondary" @click="s.dismiss(n.id)" />
    </PynViewNotice>
    <PynRecoveryCodes v-if="s.codes.value" :codes="s.codes.value" @saved="s.acknowledgeCodes" />
    <PynTotpEnrolment
      v-else-if="s.enrolment.value"
      :enrolment="s.enrolment.value"
      :busy="s.busy.value"
      :error="s.error.value"
      @confirm="s.confirm"
      @cancel="s.cancelTotp"
    />
    <template v-else-if="s.status.value">
      <PynViewGroup title="Authenticator app">
        <PynViewNotice v-if="s.error.value" tone="warning">{{ s.error.value }}</PynViewNotice>
        <div v-for="f in s.status.value.factors" :key="f.id">
          {{ f.label }}
          <PynButton
            label="Remove"
            variant="danger"
            :disabled="s.busy.value"
            @click="s.removeTotp(f.id)"
          />
        </div>
        <PynButton
          label="Add an authenticator app"
          :disabled="s.busy.value"
          @click="s.startTotp()"
        />
      </PynViewGroup>
      <PynViewGroup v-if="s.status.value.enabled" title="Recovery codes">
        {{ s.status.value.recovery_codes_left }} recovery codes left.
        <PynButton
          label="Generate new codes"
          variant="secondary"
          :disabled="s.busy.value"
          @click="s.regenerate()"
        />
      </PynViewGroup>
      <PynPasskeys
        :passkeys="s.status.value.passkeys ?? []"
        :available="s.passkeysOffered()"
        :busy="s.busy.value"
        @add="s.addPasskey()"
        @rename="(p) => s.rename(p.id, p.name)"
        @remove="s.removeKey"
      />
    </template>
    <PynViewNotice v-else-if="s.error.value" tone="warning">{{ s.error.value }}</PynViewNotice>
  </PynViewStack>
</template>
