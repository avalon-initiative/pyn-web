<script setup lang="ts">
import { computed } from 'vue'
import styles from '../styles/PynMarkdown.module.scss'
import { renderMarkdown } from '../state/markdown.state'

const props = defineProps<{
  source: string
  owner: string
  name: string
  /** Folder of the document, for resolving relative links and images. */
  dir?: string
}>()

const html = computed(() =>
  renderMarkdown(props.source, { owner: props.owner, name: props.name }, props.dir ?? ''),
)
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitised by DOMPurify in renderMarkdown -->
  <div data-markdown :class="styles.markdown" v-html="html" />
</template>
