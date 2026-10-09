<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { resendVerification, verifyEmail } from '../api/auth'
import PynVerifyEmail from '../components/PynVerifyEmail.vue'
import { useAction } from '../state/action.state'
import type { Registered, VerifyOutcome } from '../types/auth.types'

const route = useRoute()
const outcome = ref<VerifyOutcome>('verifying')
const result = ref<Registered | null>(null)
const sent = ref(false)
const verify = useAction()
const resend = useAction()

onMounted(async () => {
  const token = [route.query.token].flat()[0]
  if (!token) {
    outcome.value = 'invalid'
    return
  }
  const ok = await verify.attempt(async () => {
    result.value = await verifyEmail(token)
  })
  outcome.value = ok ? 'verified' : 'invalid'
})

const again = (email: string) =>
  resend.attempt(async () => {
    sent.value = false
    await resendVerification(email)
    sent.value = true
  })
</script>

<template>
  <PynVerifyEmail
    :outcome="outcome"
    :status="result?.status"
    :user="result?.user"
    :error="verify.error.value"
    :resend-error="resend.error.value"
    :busy="resend.busy.value"
    :sent="sent"
    @resend="again"
  />
</template>
