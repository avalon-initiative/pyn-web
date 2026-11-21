<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../api/client'
import { fetchContent, fetchTree } from '../api/repos'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { useBranch } from '../state/branch.state'
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
const branch = useBranch()
const entry = ref<TreeEntry | null>(null)
const body = ref<FileBody | null>(null)
const missing = ref(false)
const lines = computed(() => parseLineHash(route.hash))
const now = ref(new Date())
const { error, attempt } = useAction()
let loadedRevision: number | null = null
let timer: ReturnType<typeof setInterval> | undefined

async function bodyFor(p: string, e: TreeEntry, b?: string): Promise<FileBody> {
  if (!e.last_change) return { kind: 'none' }
  if (fileKind(p) === 'image') {
    const src = contentUrl(target.value, p)
    return { kind: 'image', src: b ? `${src}&branch=${encodeURIComponent(b)}` : src }
  }
  return fileBody(p, await fetchContent(target.value, p, VIEW_LIMIT, undefined, b))
}

async function refresh() {
  now.value = new Date()
  const p = path.value
  const b = branch.value
  await attempt(async () => {
    let found: TreeEntry | undefined
    try {
      const tree = await fetchTree(target.value, parentOf(p), b)
      const hit = entryAt(tree.entries, p)
      if (hit?.kind === 'folder') {
        if (p === path.value)
          await router.replace({ path: treePath(target.value, p), query: route.query })
        return
      }
      found = hit ?? undefined
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'path_not_found')) throw e
    }
    if (p !== path.value || b !== branch.value) return
    missing.value = !found
    entry.value = found ?? null
    if (!found) return
    const revision = found.last_change?.id ?? null
    if (body.value && revision === loadedRevision) return
    const next = await bodyFor(p, found, b)
    if (p !== path.value || b !== branch.value) return
    body.value = next
    loadedRevision = revision
  })
}

watch([path, branch], () => {
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
