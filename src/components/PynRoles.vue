<script setup lang="ts">
import { reactive } from 'vue'
import styles from '../styles/PynRoles.module.scss'
import { PERMISSIONS } from '../state/repo.state'
import type { RoleGrant } from '../types/repo.types'

const props = defineProps<{
  grants: RoleGrant[]
  canEdit?: boolean
  busy?: boolean
  error?: string
}>()
const emit = defineEmits<{ save: [RoleGrant] }>()

const draft = reactive<Record<string, string[]>>(
  Object.fromEntries(props.grants.map((g) => [g.role, [...g.permissions]])),
)
</script>

<template>
  <section :class="styles.page">
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <form
      v-for="g in grants"
      :key="g.role"
      :class="styles.role"
      @submit.prevent="emit('save', { role: g.role, permissions: draft[g.role] })"
    >
      <h3 :class="styles.heading">{{ g.role }}</h3>
      <div :class="styles.perms">
        <label v-for="p in PERMISSIONS" :key="p" :class="styles.perm">
          <input v-model="draft[g.role]" type="checkbox" :value="p" :disabled="!canEdit" />
          {{ p }}
        </label>
      </div>
      <button v-if="canEdit" type="submit" :class="styles.button" :disabled="busy">
        Save {{ g.role }}
      </button>
    </form>
  </section>
</template>
