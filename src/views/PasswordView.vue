<script setup lang="ts">
import { PynPasswordForm } from '@avalon-initiative/pyn-common-ui'
import { onMounted, ref } from 'vue'
import { fetchMe } from '../api/admin'
import { changePassword } from '../api/password'
import { PASSWORD_CHANGE_REASON, passwordChangeRequired } from '../state/password-change.state'
import {
  PASSWORD_CHANGED,
  PASSWORD_MIN_LENGTH,
  PASSWORD_SET,
  PASSWORD_RULES,
  passwordError,
} from '../state/password.state'

const busy = ref(false)
const error = ref('')
const success = ref('')
const hasPassword = ref(true)

onMounted(async () => {
  hasPassword.value = (await fetchMe().catch(() => null))?.has_password !== false
})

async function submit(form: { current?: string; next: string }) {
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    const first = !hasPassword.value
    await changePassword(first ? undefined : form.current, form.next)
    if (first) hasPassword.value = true
    passwordChangeRequired.value = false
    success.value = first ? PASSWORD_SET : PASSWORD_CHANGED
  } catch (e) {
    error.value = passwordError(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <PynPasswordForm
    :rules="PASSWORD_RULES"
    :min-length="PASSWORD_MIN_LENGTH"
    :has-password="hasPassword"
    :busy="busy"
    :error="error"
    :success="success"
    :reason="passwordChangeRequired ? PASSWORD_CHANGE_REASON : undefined"
    @submit="submit"
  />
</template>
