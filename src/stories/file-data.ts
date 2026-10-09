import type { TreeEntry } from '../types/tree.types'
import { lock, now } from './landing-data'

export const readmeText = `# Castle Quest

A small action game. Build it with \`make build\`.

## Layout

- \`Source/\` gameplay code
- [Level notes](Content/Levels/Notes.md)
- [Content](Content/)

| Folder  | Mode      |
| ------- | --------- |
| Source  | shared    |
| Content | exclusive |

\`\`\`cpp
void APlayer::Tick(float dt) {
  // move the player
  Velocity += Gravity * dt;
}
\`\`\`

> Binary assets are locked while someone edits them.

<script>alert('removed by the sanitiser')</script>
`

export const codeText = `import { ref } from 'vue'

/* A comment
   across two lines */
export function useCount(start = 0) {
  const count = ref(start)
  const label = \`count: \${count.value}\`
  return { count, label }
}
`

const at = new Date(now.getTime() - 2 * 3_600_000).toISOString()

export const fileEntry: TreeEntry = {
  name: 'useCount.ts',
  path: 'Source/useCount.ts',
  kind: 'file',
  mode: 'shared',
  last_change: {
    id: 61,
    path: 'Source/useCount.ts',
    author: 'jamie',
    message: 'Add counter',
    created_at: at,
  },
}

export const lockedEntry: TreeEntry = {
  ...fileEntry,
  name: 'Level01.umap',
  path: 'Content/Level01.umap',
  mode: 'exclusive',
  lock: lock('Content/Level01.umap', 'bob', 90),
}

export const imageSrc =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="#3857d6"/></svg>',
  )
