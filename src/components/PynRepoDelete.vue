<script setup lang="ts">
import { computed, ref } from 'vue'
import styles from '../styles/PynRepoDelete.module.scss'

const props = defineProps<{ slug: string; busy?: boolean; error?: string }>()
const emit = defineEmits<{ remove: [] }>()

const typed = ref('')
const matches = computed(() => typed.value === props.slug)
</script>

<template>
  <form :class="styles.form" @submit.prevent="matches && emit('remove')">
    <h3 :class="styles.heading">Delete this repository</h3>
    <p :class="styles.note">
      This removes its files, history, locks, members and invitations. The audit log is kept. Type
      <code>{{ slug }}</code> to confirm.
    </p>
    <input v-model="typed" :class="styles.input" :aria-label="`Type ${slug} to confirm`" />
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <button type="submit" :class="styles.danger" :disabled="busy || !matches">
      Delete repository
    </button>
  </form>
</template>
