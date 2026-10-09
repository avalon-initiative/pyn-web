import type { Preview } from '@storybook/vue3'
import '../src/styles/global.scss'
import { applyTheme } from '../src/state/theme.state'
import type { ThemeChoice } from '../src/state/theme.state'

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
