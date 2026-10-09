<script setup lang="ts">
import { ref } from 'vue'
import styles from '../styles/PynResendForm.module.scss'

defineProps<{ busy?: boolean; sent?: boolean; error?: string }>()
const emit = defineEmits<{ resend: [string] }>()
const email = ref('')
</script>

<template>
  <form :class="styles.form" @submit.prevent="emit('resend', email)">
    <label :class="styles.field"
      >Email address
      <input
        v-model.trim="email"
        :class="styles.input"
        type="email"
        autocomplete="email"
        required
      />
    </label>
    <p v-if="sent" :class="styles.sent" role="status">
      If that address has a pending account, a new link is on its way.
    </p>
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <button type="submit" :class="styles.button" :disabled="busy">Resend verification email</button>
  </form>
</template>
