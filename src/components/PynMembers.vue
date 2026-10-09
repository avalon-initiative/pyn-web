<script setup lang="ts">
import styles from '../styles/PynMembers.module.scss'
import { isEditable, sourceNote } from '../state/team.state'
import type { Grantee } from '../types/team.types'

withDefaults(
  defineProps<{
    grantees: Grantee[]
    roles: string[]
    /** What the rows are, for labels and the empty text. */
    kind?: 'person' | 'team'
    /** Show a button that takes the grant away. */
    revocable?: boolean
    title?: string
    busy?: boolean
    error?: string
  }>(),
  { kind: 'person' },
)
const emit = defineEmits<{ setRole: [{ name: string; role: string }]; revoke: [name: string] }>()

const change = (name: string, e: Event) =>
  emit('setRole', { name, role: (e.target as HTMLSelectElement).value })
</script>

<template>
  <section :class="styles.page">
    <h3 v-if="title" :class="styles.subheading">{{ title }}</h3>
    <ul v-if="grantees.length" :class="styles.list">
      <li v-for="g in grantees" :key="g.name" :class="styles.item">
        <span :class="styles.who">
          <a v-if="g.href" :href="g.href" :class="styles.link">{{ g.name }}</a>
          <strong v-else>{{ g.name }}</strong>
          <span v-if="sourceNote(g.source)" :class="styles.note" data-source>{{
            sourceNote(g.source)
          }}</span>
        </span>
        <span :class="styles.actions">
          <select
            v-if="isEditable(g)"
            :class="styles.input"
            :value="g.role"
            :aria-label="`Role of ${g.name}`"
            :disabled="busy"
            @change="change(g.name, $event)"
          >
            <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
          </select>
          <span v-else :class="styles.pill" data-role>{{ g.role }}</span>
          <button
            v-if="revocable && isEditable(g)"
            type="button"
            :class="styles.danger"
            :disabled="busy"
            :aria-label="`Revoke ${g.name}`"
            @click="emit('revoke', g.name)"
          >
            Revoke
          </button>
        </span>
      </li>
    </ul>
    <p v-else :class="styles.empty">{{ kind === 'team' ? 'No teams.' : 'No members.' }}</p>
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <slot />
  </section>
</template>
