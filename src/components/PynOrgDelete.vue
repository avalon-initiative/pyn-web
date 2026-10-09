<script setup lang="ts">
import { computed, ref } from 'vue'
import styles from '../styles/PynOrgDelete.module.scss'

const props = defineProps<{ name: string; busy?: boolean; error?: string }>()
const emit = defineEmits<{ remove: [] }>()

const typed = ref('')
const matches = computed(() => typed.value === props.name)
</script>

<template>
  <form :class="styles.form" @submit.prevent="matches && emit('remove')">
    <h3 :class="styles.heading">Delete this organization</h3>
    <p :class="styles.note">
      It must own no repositories; delete them first. Its members lose their membership and the
      audit log is kept. Type <code>{{ name }}</code> to confirm.
    </p>
    <input v-model="typed" :class="styles.input" :aria-label="`Type ${name} to confirm`" />
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <button type="submit" :class="styles.danger" :disabled="busy || !matches">
      Delete organization
    </button>
  </form>
</template>
