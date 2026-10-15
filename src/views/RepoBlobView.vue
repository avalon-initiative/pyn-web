<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../api/client'
import { fetchContent, fetchTree } from '../api/repos'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { useHashScroll } from '../state/hash.state'
import {
  PynFileView,
  contentUrl,
  entryAt,
  fileBody,
  fileKind,
  folderParam,
  lineHash,
  parentOf,
  parseLineHash,
  treePath,
  VIEW_LIMIT,
  type FileBody,
  type LineRange,
  type TreeEntry,
  PynViewError,
} from '@avalon-initiative/pyn-common-ui'

const { target } = inject(repoKey)!
const user = inject(sessionKey)!.user
const route = useRoute()
const router = useRouter()
const path = computed(() => folderParam(route.params.path))
const entry = ref<TreeEntry | null>(null)
const body = ref<FileBody | null>(null)
const missing = ref(false)
const lines = computed(() => parseLineHash(route.hash))
const now = ref(new Date())
const { error, attempt } = useAction()
let loadedRevision: number | null = null
let timer: ReturnType<typeof setInterval> | undefined

async function bodyFor(p: string, e: TreeEntry): Promise<FileBody> {
  if (!e.last_change) return { kind: 'none' }
  if (fileKind(p) === 'image') return { kind: 'image', src: contentUrl(target.value, p) }
  return fileBody(p, await fetchContent(target.value, p, VIEW_LIMIT))
}

async function refresh() {
  now.value = new Date()
  const p = path.value
  await attempt(async () => {
    let found: TreeEntry | undefined
    try {
      const tree = await fetchTree(target.value, parentOf(p))
      const hit = entryAt(tree.entries, p)
      if (hit?.kind === 'folder') {
        if (p === path.value) await router.replace(treePath(target.value, p))
        return
      }
      found = hit ?? undefined
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'path_not_found')) throw e
    }
    if (p !== path.value) return
    missing.value = !found
    entry.value = found ?? null
    if (!found) return
    const revision = found.last_change?.id ?? null
    if (body.value && revision === loadedRevision) return
    const next = await bodyFor(p, found)
    if (p !== path.value) return
    body.value = next
    loadedRevision = revision
  })
}

watch(path, () => {
  entry.value = null
  body.value = null
  missing.value = false
  loadedRevision = null
  refresh()
})

const selectLines = (r: LineRange) => router.push({ hash: lineHash(r) })
useHashScroll(() => body.value)

onMounted(() => {
  refresh()
  timer = setInterval(refresh, 15_000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <PynViewError v-if="error">{{ error }}</PynViewError>
  <PynFileView
    :owner="target.owner"
    :name="target.name"
    :path="path"
    :entry="entry"
    :body="body"
    :missing="missing"
    :me="user"
    :now="now"
    :lines="lines"
    @select-lines="selectLines"
  />
</template>
