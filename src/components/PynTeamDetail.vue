<script setup lang="ts">
import { ref } from 'vue'
import styles from '../styles/PynTeamDetail.module.scss'
import { formatDate } from '../state/datetime.state'
import { repoPath } from '../state/repo.state'
import { splitRepo } from '../state/team.state'
import type { TeamInfo } from '../types/team.types'

defineProps<{
  team: TeamInfo
  /** Organization members who could be added. */
  candidates: string[]
  /** Owners add and remove members. */
  owner: boolean
  busy?: boolean
  error?: string
}>()
const emit = defineEmits<{ add: [user: string]; remove: [user: string] }>()

const picked = ref('')

function add() {
  if (!picked.value) return
  emit('add', picked.value)
  picked.value = ''
}
</script>

<template>
  <section :class="styles.page">
    <header :class="styles.header">
      <h2 :class="styles.title">{{ team.name }}</h2>
      <p :class="styles.meta">
        <code>{{ team.slug }}</code> · created {{ formatDate(team.created_at) }}
      </p>
      <p v-if="team.description" :class="styles.description">{{ team.description }}</p>
    </header>

    <h3 :class="styles.subheading">Members</h3>
    <ul v-if="team.members.length" :class="styles.list" data-members>
      <li v-for="u in team.members" :key="u" :class="styles.item">
        <strong>{{ u }}</strong>
        <button
          v-if="owner"
          type="button"
          :class="styles.danger"
          :disabled="busy"
          :aria-label="`Remove ${u}`"
          @click="emit('remove', u)"
        >
          Remove
        </button>
      </li>
    </ul>
    <p v-else :class="styles.empty">No members.</p>
    <form v-if="owner" :class="styles.form" @submit.prevent="add">
      <p v-if="!candidates.length" :class="styles.empty">
        Every member of the organization is in this team.
      </p>
      <template v-else>
        <label :class="styles.field"
          >Add an organization member
          <select v-model="picked" :class="styles.input" required>
            <option value="" disabled>Choose a member</option>
            <option v-for="c in candidates" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
        <button type="submit" :class="styles.primary" :disabled="busy">Add</button>
      </template>
    </form>
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>

    <h3 :class="styles.subheading">Repositories</h3>
    <ul v-if="team.repos.length" :class="styles.list" data-repos>
      <li v-for="r in team.repos" :key="r.repo" :class="styles.item">
        <a :href="repoPath(splitRepo(r.repo))" :class="styles.link">{{ r.repo }}</a>
        <span :class="styles.pill" data-role>{{ r.role }}</span>
      </li>
    </ul>
    <p v-else :class="styles.empty">This team has no role on any repository.</p>
  </section>
</template>
