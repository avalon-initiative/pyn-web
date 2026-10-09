<script setup lang="ts">
import { computed, ref } from 'vue'
import PynIcon from './PynIcon.vue'
import styles from '../styles/PynSearch.module.scss'
import { matchRepos } from '../state/shell.state'

const props = defineProps<{ options: string[]; placeholder?: string }>()
const emit = defineEmits<{ open: [slug: string] }>()

const query = ref('')
const matches = computed(() => matchRepos(props.options, query.value).slice(0, 8))

function submit() {
  const hit = props.options.find((o) => o === query.value.trim()) ?? matches.value[0]
  if (!hit) return
  query.value = ''
  emit('open', hit)
}
</script>

<template>
  <form :class="styles.search" role="search" @submit.prevent="submit">
    <PynIcon name="search" :class="styles.icon" />
    <input
      v-model="query"
      type="search"
      list="pyn-search-options"
      :class="styles.input"
      :placeholder="placeholder ?? 'Find a repository…'"
      aria-label="Find a repository"
    />
    <datalist id="pyn-search-options">
      <option v-for="slug in matches" :key="slug" :value="slug" />
    </datalist>
  </form>
</template>
