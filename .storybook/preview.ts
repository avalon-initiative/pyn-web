import type { Preview } from '@storybook/vue3'
import '@avalon-initiative/pyn-common-ui/tokens.css'
import '@avalon-initiative/pyn-common-ui/global.css'
import { applyTheme } from '@avalon-initiative/pyn-common-ui'
import type { ThemeChoice } from '@avalon-initiative/pyn-common-ui'

const preview: Preview = {
  parameters: { layout: 'padded' },
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        dynamicTitle: true,
        items: [
          { value: 'system', title: 'System' },
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
  },
  initialGlobals: { theme: 'system' },
  decorators: [
    (story, context) => {
      applyTheme(context.globals.theme as ThemeChoice)
      return story()
    },
  ],
}
export default preview
