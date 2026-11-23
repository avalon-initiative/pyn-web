<script setup lang="ts">
import { PynBranchList, repoPath } from '@avalon-initiative/pyn-common-ui'
import type { BranchListItem } from '@avalon-initiative/pyn-common-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { compareBranch, listBranches } from '../api/repos'
import { useAction } from '../state/action.state'
import { repoKey } from '../state/context.state'
import type { Branch } from '../types/repo.types'

const COMPARE_LIMIT = 20

const { target } = inject(repoKey)!
const branches = ref<Branch[]>([])
const counts = ref<Record<string, { ahead: number; behind: number }>>({})
const loading = ref(true)
const { error, attempt } = useAction()
let seq = 0

// Ahead and behind come from the compare summary; a branch it fails for shows none.
async function compareAll(t: typeof target.value, list: Branch[], mine: number) {
  const others = list.filter((b) => !b.default).slice(0, COMPARE_LIMIT)
  await Promise.all(
    others.map(async (b) => {
      try {
        const c = await compareBranch(t, b.name)
        if (mine === seq) counts.value[b.name] = { ahead: c.ahead, behind: c.behind }
      } catch {
        // No counts for this branch.
      }
    }),
  )
}

async function load() {
  const mine = ++seq
  const t = target.value
  loading.value = true
  counts.value = {}
  await attempt(async () => {
    const list = await listBranches(t)
    if (mine !== seq) return
    branches.value = list
    loading.value = false
    await compareAll(t, list, mine)
  })
  if (mine === seq) loading.value = false
}

const items = computed<BranchListItem[]>(() =>
  branches.value.map((b) => {
    const href = repoPath(target.value, '', b.default ? undefined : b.name)
    return {
      name: b.name,
      isDefault: b.default,
      updatedAt: b.updated_at,
      href,
      ...(b.default ? {} : { compareHref: href, ...counts.value[b.name] }),
    }
  }),
)

onMounted(load)
watch(target, () => {
  branches.value = []
  void load()
})
</script>

<template>
  <PynBranchList
    :branches="items"
    :loading="loading"
    :error="error || undefined"
    :default-branch="branches.find((b) => b.default)?.name"
  />
</template>
