<script setup lang="ts">
import { reactive, watch } from 'vue'
import styles from '../styles/PynTeamGrant.module.scss'

const props = defineProps<{ teams: string[]; roles: string[]; busy?: boolean; error?: string }>()
const emit = defineEmits<{ grant: [{ name: string; role: string }] }>()

const form = reactive({ team: props.teams[0] ?? '', role: props.roles[0] ?? 'reader' })
watch(
  () => props.teams,
  (teams) => {
    if (!teams.includes(form.team)) form.team = teams[0] ?? ''
  },
)

const grant = () => emit('grant', { name: form.team, role: form.role })
</script>

<template>
  <form :class="styles.form" @submit.prevent="grant">
    <h3 :class="styles.subheading">Grant a team a role</h3>
    <p v-if="!teams.length" :class="styles.note">Every team already has a role here.</p>
    <template v-else>
      <label :class="styles.field"
        >Team
        <select v-model="form.team" :class="styles.input">
          <option v-for="t in teams" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
      <label :class="styles.field"
        >Role
        <select v-model="form.role" :class="styles.input" aria-label="Role for the team">
          <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
        </select>
      </label>
    </template>
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <button v-if="teams.length" type="submit" :class="styles.primary" :disabled="busy">
      Grant
    </button>
  </form>
</template>
