<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref } from 'vue'
import { fetchFiles } from '../api/repos'
import PynFileList from '../components/PynFileList.vue'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { groupByTopLevel } from '../state/files.state'
import styles from '../styles/View.module.scss'
import type { FileRow } from '../types/lock.types'

const { target } = inject(repoKey)!
const user = inject(sessionKey)!.user
const rows = ref<FileRow[]>([])
const now = ref(new Date())
const { error, attempt } = useAction()
let timer: ReturnType<typeof setInterval> | undefined

const groups = computed(() => groupByTopLevel(rows.value))
const lockedCount = computed(() => rows.value.filter((r) => r.lock).length)

async function refresh() {
  now.value = new Date()
  await attempt(async () => {
    rows.value = await fetchFiles(target.value)
  })
}

onMounted(() => {
  refresh()
  timer = setInterval(refresh, 15_000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <p :class="styles.summary">{{ rows.length }} files, {{ lockedCount }} locked</p>
  <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
  <section v-for="group in groups" :key="group.name" :class="styles.group">
    <h2 :class="styles.groupTitle">{{ group.name }}</h2>
    <PynFileList :rows="group.rows" :me="user" :now="now" />
  </section>
</template>
