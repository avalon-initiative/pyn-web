import { ref } from 'vue'
import { ApiError, describeError } from '../api/client'

type Mode = 'create' | 'delete'

interface Operations {
  create: (name: string, from: string) => Promise<void>
  remove?: (name: string, force: boolean) => Promise<void>
}

/** State of the create and delete branch dialog; a `branch_not_merged` answer asks for the force step. */
export function useBranchDialog(ops: Operations) {
  const open = ref(false)
  const mode = ref<Mode>('create')
  const name = ref('')
  const from = ref<string | undefined>()
  const unmerged = ref(false)
  const busy = ref(false)
  const error = ref('')

  function show(next: Mode, branch = '', start?: string) {
    mode.value = next
    name.value = branch
    from.value = start
    unmerged.value = false
    error.value = ''
    open.value = true
  }

  async function run(action: () => Promise<void>, onError?: (e: unknown) => boolean) {
    busy.value = true
    error.value = ''
    try {
      await action()
      open.value = false
    } catch (e) {
      if (!onError?.(e)) error.value = describeError(e)
    } finally {
      busy.value = false
    }
  }

  return {
    open,
    mode,
    name,
    from,
    unmerged,
    busy,
    error,
    openCreate: (start?: string) => show('create', '', start),
    openDelete: (branch: string) => show('delete', branch),
    close: () => (open.value = false),
    create: (p: { name: string; from: string }) => run(() => ops.create(p.name, p.from)),
    remove: (p: { name: string; force: boolean }) =>
      run(
        async () => ops.remove?.(p.name, p.force),
        (e) => {
          if (p.force || !(e instanceof ApiError && e.code === 'branch_not_merged')) return false
          unmerged.value = true
          return true
        },
      ),
  }
}
