import type { FontSet, IconPack } from '@avalon-initiative/pyn-common-ui'

/** Deployment settings read at start: a font set id and an optional icon pack (name to SVG). */
export interface HostConfig {
  fontSet: FontSet
  iconPack: IconPack | null
}
