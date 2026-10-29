import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { OwnerFreeze } from '@avalon-initiative/pyn-common-ui'

/** Loads the freeze of `owner`, again when it changes; a refused or failed read means not frozen. */
export function useOwnerFreeze(owner: Ref<string>, read: (owner: string) => Promise<OwnerFreeze>) {
  const freeze = ref<OwnerFreeze | null>(null)
  const frozen = computed(() => freeze.value?.frozen === true)

  async function load() {
    const name = owner.value
    freeze.value = null
    const found = await read(name).catch(() => null)
    if (name === owner.value) freeze.value = found
  }

  watch(owner, load, { immediate: true })
  return { freeze, frozen, load }
}

/** A write permission is usable only while the owner is not frozen. */
export const canWrite = (allowed: boolean, frozen: boolean) => allowed && !frozen
