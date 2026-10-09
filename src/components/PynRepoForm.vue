<script setup lang="ts">
import { ref } from 'vue'
import styles from '../styles/PynRepoForm.module.scss'
import { MAX_LOCKS_MAX, MAX_LOCKS_MIN, parseLockLimit } from '../state/repo.state'
import type { RepoFormValue, RepoSettings, Visibility } from '../types/repo.types'

const props = defineProps<{
  owner: string
  /** Offers an owner picker when there is a choice (yourself or organizations you own). */
  owners?: string[]
  /** Present when editing an existing repository. */
  repo?: RepoFormValue
  /** Effective lock limit, shown while the policy file sets it or the setting is empty. */
  effectiveMaxLocks?: number
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{ submit: [RepoSettings]; 'update:owner': [string] }>()

const name = ref(props.repo?.name ?? '')
const visibility = ref<Visibility>(props.repo?.visibility ?? 'private')
const leaseHours = ref(props.repo?.lease_hours ?? 8)

const byPolicy = props.repo?.max_locks_set_by_policy ?? false
const maxLocks = ref<string | number>(
  byPolicy ? (props.effectiveMaxLocks ?? '') : (props.repo?.max_locks_per_user_setting ?? ''),
)

// Empty clears the setting when editing and takes the server default when creating.
const submit = () => {
  const settings: RepoSettings = {
    name: name.value.trim(),
    visibility: visibility.value,
    lease_hours: Number(leaseHours.value),
  }
  const limit = parseLockLimit(maxLocks.value) ?? (props.repo ? null : undefined)
  if (!byPolicy && limit !== undefined) settings.max_locks_per_user = limit
  emit('submit', settings)
}
</script>

<template>
  <form :class="styles.form" @submit.prevent="submit">
    <label v-if="owners && owners.length > 1" :class="styles.field"
      >Owner
      <select
        :class="styles.input"
        :value="owner"
        @change="emit('update:owner', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="o in owners" :key="o" :value="o">{{ o }}</option>
      </select>
    </label>
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
    <label :class="styles.field"
      >Lock limit per user
      <input
        v-model="maxLocks"
        :class="styles.input"
        type="number"
        :min="MAX_LOCKS_MIN"
        :max="MAX_LOCKS_MAX"
        step="1"
        :readonly="byPolicy"
        :placeholder="
          effectiveMaxLocks ? `Server default (${effectiveMaxLocks})` : 'Server default'
        "
        aria-describedby="max-locks-hint"
      />
      <span id="max-locks-hint" :class="styles.hint">
        <template v-if="byPolicy"
          >Set by .pyn/pyn.toml; edit the policy file to change it.</template
        >
        <template v-else
          >Active locks one user may hold at once. Leave empty for the server default.</template
        >
      </span>
    </label>
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <button type="submit" :class="styles.primary" :disabled="busy">
      {{ repo ? 'Save changes' : 'Create repository' }}
    </button>
  </form>
</template>
