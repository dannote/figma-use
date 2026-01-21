import { defineCommand } from 'citty'

import fonts from './fonts.ts'
import jsx from './jsx.ts'
import node from './node.ts'
import screenshot from './screenshot.ts'
import selection from './selection.ts'
import storybook from './storybook.ts'

export default defineCommand({
  meta: { description: 'Export images and code' },
  subCommands: {
    fonts,
    node,
    selection,
    screenshot,
    jsx,
    storybook
  }
})
