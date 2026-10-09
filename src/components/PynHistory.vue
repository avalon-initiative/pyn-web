<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import styles from '../styles/PynHistory.module.scss'
import { FILTER_DEBOUNCE_MS } from '../state/history.state'
import type { Revision } from '../types/repo.types'

const props = defineProps<{
  revisions: Revision[]
  filter?: string
  path?: string
  hasMore?: boolean
  loading?: boolean
  busy?: boolean
  error?: string
}>()
const emit = defineEmits<{ filter: [string]; more: []; clearPath: [] }>()

const typed = ref(props.filter ?? '')
let timer: ReturnType<typeof setTimeout> | undefined

watch(typed, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => emit('filter', v.trim()), FILTER_DEBOUNCE_MS)
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <section :class="styles.page">
    <div v-if="path" :class="styles.scope">
      <span
        >History of <code :class="styles.path">{{ path }}</code></span
      >
      <button type="button" :class="styles.button" @click="emit('clearPath')">
        All repository history
      </button>
    </div>
    <div v-else :class="styles.search">
      <input
        v-model="typed"
        type="search"
        :class="styles.input"
        placeholder="Filter by path, e.g. *.ts"
        aria-label="Filter by path pattern"
        spellcheck="false"
      />
      <p :class="styles.hint">
        Glob over paths, for example <code>*.ts</code> or <code>Content/*.uasset</code>. A trailing
        <code>/</code> matches a folder.
      </p>
    </div>
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <p v-if="loading && !revisions.length" :class="styles.empty">Loading history…</p>
    <ul v-else-if="revisions.length" :class="styles.list">
      <li v-for="rev in revisions" :key="`${rev.id}:${rev.path}`" :class="styles.item">
        <div :class="styles.main">
          <div>
            <strong :class="styles.rev">r{{ rev.id }}</strong>
            <span :class="[styles.path, styles.revPath]">{{ rev.path }}</span>
            <span v-if="rev.restored_from != null" :class="styles.pill"
              >restored from r{{ rev.restored_from }}</span
            >
          </div>
          <div :class="styles.message">{{ rev.message }}</div>
        </div>
        <div :class="styles.meta">{{ rev.author }} · {{ rev.created_at.slice(0, 10) }}</div>
      </li>
    </ul>
    <p v-else-if="!error" :class="styles.empty">
      {{ path ? `No revisions of ${path}.` : filter ? 'No revisions match.' : 'No revisions yet.' }}
    </p>
    <button
      v-if="hasMore"
      type="button"
      :class="styles.button"
      :disabled="busy"
      @click="emit('more')"
    >
      Load more
    </button>
  </section>
</template>
