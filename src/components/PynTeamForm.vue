<script setup lang="ts">
import { reactive } from 'vue'
import styles from '../styles/PynTeamForm.module.scss'
import type { TeamFormValue } from '../types/team.types'

const props = defineProps<{
  /** Present when editing: the slug is fixed and the fields start from it. */
  team?: { slug: string; name: string; description: string }
  busy?: boolean
  error?: string
}>()
const emit = defineEmits<{ submit: [TeamFormValue] }>()

const form = reactive({
  slug: '',
  name: props.team?.name ?? '',
  description: props.team?.description ?? '',
})

function submit() {
  const value: TeamFormValue = { name: form.name.trim(), description: form.description.trim() }
  if (!props.team) {
    value.slug = form.slug.trim()
    form.slug = ''
    form.name = ''
    form.description = ''
  }
  emit('submit', value)
}
</script>

<template>
  <form :class="styles.form" @submit.prevent="submit">
    <h3 :class="styles.subheading">{{ team ? 'Edit team' : 'Create a team' }}</h3>
    <label v-if="!team" :class="styles.field"
      >Slug
      <input
        v-model="form.slug"
        :class="styles.input"
        required
        maxlength="39"
        pattern="[a-z0-9][a-z0-9_\-]*"
        autocapitalize="none"
      />
    </label>
    <label :class="styles.field"
      >Name{{ team ? '' : ' (defaults to the slug)' }}
      <input v-model="form.name" :class="styles.input" maxlength="100" :required="!!team" />
    </label>
    <label :class="styles.field"
      >Description
      <textarea v-model="form.description" :class="styles.input" maxlength="500" rows="3" />
    </label>
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <button type="submit" :class="styles.primary" :disabled="busy">
      {{ team ? 'Save' : 'Create' }}
    </button>
  </form>
</template>
