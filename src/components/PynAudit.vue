<script setup lang="ts">
import { reactive } from 'vue'
import styles from '../styles/PynAudit.module.scss'
import { AUDIT_ACTIONS } from '../state/repo.state'
import type { AuditEntry, AuditFilter } from '../types/repo.types'

const props = defineProps<{
  entries: AuditEntry[]
  filter: AuditFilter
  hasMore?: boolean
  busy?: boolean
  error?: string
}>()
const emit = defineEmits<{ filter: [AuditFilter]; more: [] }>()

const form = reactive({ ...props.filter })
</script>

<template>
  <section :class="styles.page">
    <form :class="styles.filters" @submit.prevent="emit('filter', { ...form })">
      <input v-model="form.actor" :class="styles.input" placeholder="Actor" aria-label="Actor" />
      <input v-model="form.path" :class="styles.input" placeholder="Path" aria-label="Path" />
      <select v-model="form.action" :class="styles.input" aria-label="Action">
        <option value="">Any action</option>
        <option v-for="a in AUDIT_ACTIONS" :key="a" :value="a">{{ a }}</option>
      </select>
      <button type="submit" :class="styles.button" :disabled="busy">Filter</button>
    </form>
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <ul v-if="entries.length" :class="styles.list">
      <li v-for="e in entries" :key="e.id" :class="styles.item">
        <div>
          <span :class="styles.action">{{ e.action }}</span>
          <span v-if="e.path" :class="styles.path"> {{ e.path }}</span>
          <div :class="styles.meta">{{ e.detail }}</div>
        </div>
        <div :class="styles.meta">{{ e.actor }} · {{ e.at.slice(0, 16).replace('T', ' ') }}</div>
      </li>
    </ul>
    <p v-else :class="styles.empty">No matching events.</p>
    <button
      v-if="hasMore"
      type="button"
      :class="styles.button"
      :disabled="busy"
      @click="emit('more')"
    >
      Load older events
    </button>
  </section>
</template>
