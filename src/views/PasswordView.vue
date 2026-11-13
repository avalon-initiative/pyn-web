<script setup lang="ts">
import { PynPasswordForm } from '@avalon-initiative/pyn-common-ui'
import { ref } from 'vue'
import { changePassword } from '../api/password'
import {
  PASSWORD_CHANGED,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  passwordError,
} from '../state/password.state'

const busy = ref(false)
const error = ref('')
const success = ref('')

async function submit(form: { current: string; next: string }) {
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    await changePassword(form.current, form.next)
    success.value = PASSWORD_CHANGED
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
    :busy="busy"
    :error="error"
    :success="success"
    @submit="submit"
  />
  <p>
    An account created through an external sign-in has no password yet; setting a first one is not
    available on this page.
  </p>
</template>
