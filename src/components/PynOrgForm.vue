<script setup lang="ts">
import { ref } from 'vue'
import styles from '../styles/PynOrgForm.module.scss'

defineProps<{ busy?: boolean; error?: string }>()
const emit = defineEmits<{ submit: [name: string] }>()

const name = ref('')
</script>

<template>
  <form :class="styles.form" @submit.prevent="emit('submit', name.trim())">
    <label :class="styles.field"
      >Organization name
      <input
        v-model="name"
        :class="styles.input"
        placeholder="studio"
        required
        minlength="2"
        maxlength="39"
        autocapitalize="none"
        aria-describedby="org-name-hint"
      />
      <span id="org-name-hint" :class="styles.hint"
        >2 to 39 lowercase letters, digits, "-" or "_". It shares its namespace with user
        names.</span
      >
    </label>
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <button type="submit" :class="styles.primary" :disabled="busy">Create organization</button>
  </form>
</template>
