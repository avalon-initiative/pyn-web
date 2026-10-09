<script setup lang="ts">
import { computed } from 'vue'
import styles from '../styles/PynCodeView.module.scss'
import { highlightLines } from '../state/code.state'

const props = defineProps<{ text: string; language?: string | null }>()

const lines = computed(() => highlightLines(props.text, props.language ?? null))
</script>

<template>
  <div :class="styles.code" :data-language="language ?? 'plain'" role="region" aria-label="Code">
    <pre :class="styles.pre"><code><span
      v-for="(html, i) in lines"
      :key="i"
      :class="styles.line"
      :data-line="i + 1"
      v-html="html || ' '"
    /></code></pre>
  </div>
</template>
