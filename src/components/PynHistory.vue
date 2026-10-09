<script setup lang="ts">
import { ref } from 'vue'
import styles from '../styles/PynHistory.module.scss'
import type { Revision } from '../types/repo.types'

const props = defineProps<{ path: string; revisions: Revision[]; busy?: boolean; error?: string }>()
const emit = defineEmits<{ search: [string] }>()

const typed = ref(props.path)
</script>

<template>
  <section :class="styles.page">
    <form :class="styles.search" @submit.prevent="emit('search', typed.trim())">
      <input
        v-model="typed"
        :class="styles.input"
        placeholder="Path, e.g. Content/a.umap"
        required
      />
      <button type="submit" :class="styles.primary" :disabled="busy">Show history</button>
    </form>
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <ul v-if="revisions.length" :class="styles.list">
      <li v-for="rev in revisions" :key="rev.id" :class="styles.item">
        <div>
          <strong>r{{ rev.id }}</strong> {{ rev.message }}
          <span v-if="rev.restored_from != null" :class="styles.pill"
            >restored from r{{ rev.restored_from }}</span
          >
        </div>
        <div :class="styles.meta">{{ rev.author }} · {{ rev.created_at.slice(0, 10) }}</div>
      </li>
    </ul>
    <p v-else-if="path" :class="styles.empty">No revisions of {{ path }}.</p>
    <p v-else :class="styles.empty">Enter a path to see its revisions.</p>
  </section>
</template>
