export interface MenuItem {
  id: string
  label: string
  /** Internal link; without it the item is a button that emits its id. */
  href?: string
  /** Marks the current option of a choice item. */
  checked?: boolean
  separator?: boolean
}
