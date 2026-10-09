<script setup lang="ts">
import { ref } from 'vue'
import styles from '../styles/PynRepoForm.module.scss'
import type { RepoSettings, Visibility } from '../types/repo.types'

const props = defineProps<{
  owner: string
  /** Present when editing an existing repository. */
  repo?: RepoSettings
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{ submit: [RepoSettings] }>()

const name = ref(props.repo?.name ?? '')
const visibility = ref<Visibility>(props.repo?.visibility ?? 'private')
const leaseHours = ref(props.repo?.lease_hours ?? 8)

const submit = () =>
  emit('submit', {
    name: name.value.trim(),
    visibility: visibility.value,
    lease_hours: Number(leaseHours.value),
  })
</script>

<template>
  <form :class="styles.form" @submit.prevent="submit">
    <label :class="styles.field"
      >Name
      <span :class="styles.name">
        <span :class="styles.owner">{{ owner }}/</span>
        <input
          v-model="name"
          :class="styles.input"
          placeholder="game"
          required
          maxlength="100"
          autocapitalize="none"
        />
      </span>
    </label>
    <label :class="styles.field"
      >Visibility
      <select v-model="visibility" :class="styles.input">
        <option value="private">private</option>
        <option value="public">public</option>
      </select>
    </label>
    <label :class="styles.field"
      >Lease length (hours)
      <input v-model="leaseHours" :class="styles.input" type="number" min="1" max="720" required />
    </label>
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <button type="submit" :class="styles.primary" :disabled="busy">
      {{ repo ? 'Save changes' : 'Create repository' }}
    </button>
  </form>
</template>
