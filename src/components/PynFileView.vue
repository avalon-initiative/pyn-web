<script setup lang="ts">
import PynBreadcrumb from './PynBreadcrumb.vue'
import PynCodeView from './PynCodeView.vue'
import PynFileBar from './PynFileBar.vue'
import PynMarkdown from './PynMarkdown.vue'
import styles from '../styles/PynFileView.module.scss'
import { baseName, fileCrumbs, parentOf } from '../state/blob.state'
import { treePath } from '../state/tree.state'
import type { LineRange } from '../types/code.types'
import type { FileBody } from '../types/blob.types'
import type { TreeEntry } from '../types/tree.types'

defineProps<{
  owner: string
  name: string
  path: string
  entry?: TreeEntry | null
  /** Null while the content loads. */
  body?: FileBody | null
  /** No file at this path (or it is a folder). */
  missing?: boolean
  me?: string
  now?: Date
  /** Highlighted line range of a code file. */
  lines?: LineRange | null
}>()

defineEmits<{ selectLines: [range: LineRange] }>()
</script>

<template>
  <div :class="styles.view">
    <PynBreadcrumb :crumbs="fileCrumbs({ owner, name }, path)" />
    <div v-if="missing" :class="styles.notice" role="alert">
      <p>
        There is no file <code>/{{ path }}</code> in this repository.
      </p>
      <a :href="treePath({ owner, name }, parentOf(path))">Back to the folder</a>
    </div>
    <template v-else-if="entry">
      <PynFileBar :entry="entry" :owner="owner" :name="name" :me="me" :now="now" />
      <p v-if="!body" :class="styles.notice">Loading...</p>
      <div v-else-if="body.kind === 'markdown'" :class="styles.panel">
        <PynMarkdown :source="body.text" :owner="owner" :name="name" :dir="parentOf(path)" />
      </div>
      <PynCodeView
        v-else-if="body.kind === 'code'"
        :text="body.text"
        :language="body.language"
        :range="lines"
        @select="$emit('selectLines', $event)"
      />
      <div v-else-if="body.kind === 'image'" :class="[styles.panel, styles.image]">
        <img :src="body.src" :alt="baseName(path)" />
      </div>
      <p v-else-if="body.kind === 'empty'" :class="styles.notice">This file is empty.</p>
      <p v-else-if="body.kind === 'none'" :class="styles.notice">
        This file is locked but has no revision yet.
      </p>
      <p v-else-if="body.kind === 'large'" :class="styles.notice">
        This file is too large to display. Download it to read it.
      </p>
      <p v-else :class="styles.notice">This is a binary file. Download it to open it.</p>
    </template>
  </div>
</template>
