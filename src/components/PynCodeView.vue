<script setup lang="ts">
import { computed } from 'vue'
import styles from '../styles/PynCodeView.module.scss'
import { highlightLines } from '../state/code.state'
import { clickLine, inRange, lineHash } from '../state/lines.state'
import type { LineRange } from '../types/code.types'

const props = defineProps<{
  text: string
  language?: string | null
  /** Highlighted lines. */
  range?: LineRange | null
}>()
const emit = defineEmits<{ select: [range: LineRange] }>()

const lines = computed(() => highlightLines(props.text, props.language ?? null))

function pick(e: MouseEvent, line: number) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey) return
  e.preventDefault()
  emit('select', clickLine(props.range ?? null, line, e.shiftKey))
}
</script>

<template>
  <div :class="styles.code" :data-language="language ?? 'plain'" role="region" aria-label="Code">
    <pre :class="styles.pre"><code><span
      v-for="(html, i) in lines"
      :id="`L${i + 1}`"
      :key="i"
      :class="[styles.line, inRange(range, i + 1) && styles.selected]"
    ><a
      :class="styles.num"
      :href="lineHash({ start: i + 1, end: i + 1 })"
      :data-line="i + 1"
      :aria-label="`Line ${i + 1}`"
      @click="pick($event, i + 1)"
    /><span v-html="html || ' '" /></span></code></pre>
  </div>
</template>
